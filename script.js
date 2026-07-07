const API_URL = "https://chatbot-v2-eqxa.onrender.com";

let sessionId = localStorage.getItem("chat_session_id");
if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem("chat_session_id", sessionId);
}

let conversationState = "awaiting_mobile";
let userMobile = "";
let selectedTicketCategory = "";
let isAnyOtherTicket = false;
let isTrackOrderFlow = false;
let hasViewedOrder = false;
let uploadedPhotoUrl = "";
let hasUsedPreviousMobileForReorder = false;
let availableOrdersToReorder = [];
async function saveToBackend(data) {
    try {
        await fetch(`${API_URL}/save-data`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                session_id: sessionId,
                mobile: data.mobile,
                query: data.query
            })
        });
    } catch (err) {
        console.error(err);
    }
}
function createMessage(text, sender) {
    const chatBody = document.getElementById("chatBody");
    const div = document.createElement("div");
    div.className =
        sender === "user"
            ? "user-message"
            : "bot-message";
    if (sender === "bot") {
    div.innerHTML = text;
} else {
    div.textContent = text;
}
    chatBody.appendChild(div);
    chatBody.scrollTop = chatBody.scrollHeight;
}
function updateChatUI(text, sender) {
    createMessage(text, sender);
}
async function sendMessage() {
    const input = document.getElementById("userInput");
    const text = input.value.trim();
    if (!text) return;
    updateChatUI(text, "user");
if (conversationState === "awaiting_mobile") {

    userMobile = text;

    const mobileRegex = /^[6-9]\d{9}$/;

    if (!mobileRegex.test(text)) {

        updateChatUI(
            "Please enter a valid 10-digit mobile number.",
            "bot"
        );

        input.value = "";
        return;
    }

    await saveToBackend({
        mobile: userMobile,
        query: "Mobile Verified"
    });

    if (isTrackOrderFlow) {

        await fetchLatestOrder();

        isTrackOrderFlow = false;
        hasViewedOrder = true;

    } else {

        updateChatUI(
            "✅ Mobile number verified successfully.<br><br>How can we help you today?",
            "bot"
        );

    }

    conversationState = "idle";
    input.value = "";
    return;
}

if (conversationState === "awaiting_mobile_for_reorder") {
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobileRegex.test(text)) {
        updateChatUI("Please enter a valid 10-digit mobile number.", "bot");
        input.value = "";
        return;
    }
    userMobile = text;
    await saveToBackend({
        mobile: userMobile,
        query: "Mobile Entered for Reorder"
    });
    hasUsedPreviousMobileForReorder = true;
    await fetchOrdersForReorder(userMobile);
    input.value = "";
    return;
}

await saveToBackend({
    mobile: userMobile,
    query: text
});

const msg = text.toLowerCase().trim();

if (["hi", "hello", "hey"].includes(msg)) {

    updateChatUI(
        "Hello 👋 How can I help you today?",
        "bot"
    );

    input.value = "";
    return;
}

if (["thanks","thank you","thank u","thx"].includes(msg)) {

    updateChatUI(
        "You're welcome 😊",
        "bot"
    );

    input.value = "";
    return;
}

if (["bye","goodbye"].includes(msg)) {

    updateChatUI(
        "Have a great day! 👋",
        "bot"
    );

    input.value = "";
    return;
}

switch(conversationState){

            case "awaiting_ticket":

            try {

            await fetch(
                `${API_URL}/create-ticket`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mobile: userMobile,
                    category: selectedTicketCategory,
                    issue: text
                    })
                }
            );

            updateChatUI(
                "✅ Ticket created successfully.",
                "bot"
            );

        } catch (e) {

            updateChatUI(
                "❌ Unable to create ticket.",
                "bot"
            );
        }
    selectedTicketCategory = "";
    isAnyOtherTicket = false;
    conversationState = "idle";  
    break;
        case "awaiting_reorder_position":
            const pos = parseInt(text.trim());
            if (isNaN(pos) || pos < 1 || pos > availableOrdersToReorder.length) {
                updateChatUI(`❌ Invalid selection. Please reply with a number between 1 and ${availableOrdersToReorder.length}.`, "bot");
                break;
            }
            const selectedOrder = availableOrdersToReorder[pos - 1];
            try {
                const response = await fetch(`${API_URL}/create-reorder`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        order_no: selectedOrder.order_no
                    })
                });
                const data = await response.json();
                updateChatUI(`✅ Re-order request submitted successfully for Order No: <b>${selectedOrder.order_no}</b>.`, "bot");
            } catch (err) {
                updateChatUI("❌ Unable to submit reorder request.", "bot");
            }
            conversationState = "idle";
            availableOrdersToReorder = [];
            break;

default:

    // Loading Message
    updateChatUI(
    "🤖 Mediseller Assistant is typing...",
    "bot"
    );

    try {

        const response = await fetch(
            `${API_URL}/chat-ai`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: text
                })
            }
        );

        const data = await response.json();

        // Typing message remove karo
        const messages =
            document.querySelectorAll(".bot-message");

        const lastMessage =
            messages[messages.length - 1];

        if (
            lastMessage &&
            lastMessage.innerText === "🤖 Mediseller Assistant is typing..."
        ) {
            lastMessage.remove();
        }

        updateChatUI(
            data.reply,
            "bot"
        );

    } catch (error) {

        const messages =
            document.querySelectorAll(".bot-message");

        const lastMessage =
            messages[messages.length - 1];

        if (
            lastMessage &&
            lastMessage.innerText === "🤖 Mediseller Assistant is typing..."
        ) {
            lastMessage.remove();
        }

        updateChatUI(
            "Sorry, AI Assistant is currently unavailable.",
            "bot"
        );

    }
    }

    input.value = "";

}

// ===============================
// OPTION BUTTONS
// ===============================

async function selectOption(option) {

    if (conversationState === "awaiting_mobile" && option !== "FAQs" && option !== "Terms & Conditions") {

        updateChatUI(
            "Please enter your mobile number first.",
            "bot"
        );

        return;
    }

    updateChatUI(option, "user");
setTimeout(async () => {
    await saveToBackend({
    mobile: userMobile,
    query: option
});

    switch (option) {

case "Track My Order":

    if (!userMobile) {
        hasViewedOrder = false;

        isTrackOrderFlow = true;
        conversationState = "awaiting_mobile";

        updateChatUI(
            "📱 Please enter your mobile number.",
            "bot"
        );

        break;
    }

    if (!hasViewedOrder) {

        await fetchLatestOrder();
        break;
    }

    hasViewedOrder = false;
    isTrackOrderFlow = true;
    userMobile = "";
    conversationState = "awaiting_mobile";

    updateChatUI(
        "📱 Please enter your mobile number.",
        "bot"
    );

    break;



            case "Raise a Ticket":

                updateChatUI(`
                    <b>Please choose a category for your ticket.</b><br><br>

                    <button class="ticket-btn"
                    onclick="selectTicketCategory('Incomplete Order')">
                    📦 Incomplete Order
                    </button><br><br>

                    <button class="ticket-btn"
                    onclick="selectTicketCategory('Damaged Product')">
                    📦 Damaged Product
                    </button><br><br>

                    <button class="ticket-btn"
                    onclick="selectTicketCategory('Advance Paid but Order Not Received')">
                    💳 Advance Paid but Order Not Received
                    </button><br><br>

                    <button class="ticket-btn"
                    onclick="selectTicketCategory('Product Expiry')">
                    📅 Product Expiry
                    </button><br><br>

                    <button class="ticket-btn"
                    onclick="selectTicketCategory('Any Other')">
                    ✍️ Any Other
                    </button>
                `, "bot");

                break;

            case "Product Reorder":
                if (userMobile && !hasUsedPreviousMobileForReorder) {
                    hasUsedPreviousMobileForReorder = true;
                    await fetchOrdersForReorder(userMobile);
                } else {
                    userMobile = "";
                    hasUsedPreviousMobileForReorder = false;
                    conversationState = "awaiting_mobile_for_reorder";
                    updateChatUI(
                        "📱 Please enter your 10-digit mobile number:",
                        "bot"
                    );
                }
                break;

            case "FAQs":

    try {

        updateChatUI("🔍 Loading FAQs...", "bot");

        const response = await fetch(`${API_URL}/faq`);

        const faqs = await response.json();

        // Loading message remove
        const messages = document.querySelectorAll(".bot-message");
        const lastMessage = messages[messages.length - 1];

        if (
            lastMessage &&
            lastMessage.innerText === "🔍 Loading FAQs..."
        ) {
            lastMessage.remove();
        }

        if (!faqs.length) {
            updateChatUI("No FAQs available.", "bot");
            break;
        }

        let html = "<b>Frequently Asked Questions</b><br><br>";

        faqs.forEach((item, index) => {

            html += `
            <b>${index + 1}. ${item.Question}</b><br>
            ${item.Answer}<br><br>
            `;

        });

        updateChatUI(html, "bot");

    } catch (err) {

        updateChatUI(
            "❌ Unable to load FAQs.",
            "bot"
        );

        console.error(err);

    }

    

                break;

            case "Terms & Conditions":
                updateChatUI(`
                    <b>Terms & Conditions of Sale</b><br>
                    <i>Effective: 1st January 2025</i><br><br>
                    <div style="max-height: 250px; overflow-y: auto; padding: 12px; border: 1px solid #eeeeee; border-radius: 12px; font-size: 13px; text-align: left; background: #ffffff; line-height: 1.6; color: #444444; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                      <p style="margin-bottom: 12px;">1. <b>Acceptance:</b> These Terms form a legally binding agreement between Mediseller and the Customer. Placing an order via website, WhatsApp, IndiaMart, or any channel constitutes full and unconditional acceptance.</p>
                      <p style="margin-bottom: 12px;">2. <b>Eligibility & Prescription:</b> Services are available only to individuals 18+ years of age. A valid prescription from a licensed physician is mandatory for all Schedule H/H1/X drugs. Orders without a required prescription will be cancelled without refund.</p>
                      <p style="margin-bottom: 12px;">3. <b>Product Authenticity:</b> All products are 100% genuine, sourced from GMP/ISO-certified manufacturers. Products are verified for batch number, expiry date, and packaging integrity before dispatch.</p>
                      <p style="margin-bottom: 12px;">4. <b>Pricing & Payment:</b> All prices are in INR (domestic) or USD (international) and may change without notice. Full advance payment is required before dispatch. Mediseller will never request payment to personal or unofficial accounts.</p>
                      <p style="margin-bottom: 12px;">5. <b>Order Confirmation & WhatsApp Orders:</b> An order is confirmed only upon receipt of Mediseller's written confirmation and payment verification. WhatsApp orders are valid only on Mediseller's official business number and are binding once confirmed.</p>
                      <p style="margin-bottom: 12px;">6. <b>Shipping & Delivery:</b> Domestic delivery: 3–7 working days. International delivery: 7–30 working days via Aramex, DHL, FedEx, or EMS. Tracking details shared upon dispatch. Timelines are estimates, not guarantees.</p>
                      <p style="margin-bottom: 12px;">7. <b>Delay Disclaimer:</b> Mediseller is not liable for delays caused by courier operations, customs clearance, natural disasters, public holidays, government restrictions, or any force majeure event. Customer care will assist in tracking.</p>
                      <p style="margin-bottom: 12px;">8. <b>Customs & Import Responsibility:</b> International buyers are solely responsible for customs duties, import taxes, compliance with local import laws, and clearance of shipments at destination. Mediseller bears no liability for seizures or confiscation by customs authorities.</p>
                      <p style="margin-bottom: 12px;">9. <b>Cancellation Policy:</b> Cancellations must be requested within 2 hours of order confirmation and before dispatch. No cancellation is accepted once an order is dispatched. International orders are non-cancellable once confirmed. Advance payments are non-refundable.</p>
                      <p style="margin-bottom: 12px;">10. <b>Refund & Replacement — STRICT 24-HOUR RULE:</b> Complaints must be raised within 24 hours of delivery with an unboxing video and photographic evidence. No refund or replacement will be issued after 24 hours, for opened/used medicines, for delivery delays, or without video proof. Approved refunds processed within 7–14 working days.</p>
                      <p style="margin-bottom: 12px;">11. <b>RTO (Return to Origin):</b> If a shipment is returned undelivered due to customer fault (wrong address, unavailability, refusal), re-shipping charges are fully borne by the customer. The ₹200 COD confirmation charge is non-refundable in all cases.</p>
                      <p style="margin-bottom: 12px;">12. <b>AI-Generated / Manipulated Evidence — Strictly Prohibited:</b> Submitting AI-generated, digitally manipulated, edited, or fabricated images or videos as evidence of damage, missing items, or wrong products is a serious criminal offence. Mediseller uses digital forensic verification and reserves the right to file an FIR and initiate legal proceedings under the Information Technology Act, 2000 (Sections 43, 65, 66, 66C, 66D), Indian Penal Code (Sections 415, 420, 468, 471 — Fraud, Forgery & Cheating), and Consumer Protection Act, 2019. The customer shall be permanently blacklisted and liable for all legal costs and damages incurred by Mediseller.</p>
                      <p style="margin-bottom: 12px;">13. <b>Fake Complaint & Fraud Protection:</b> False, fabricated, or unsubstantiated complaints will be rejected and may result in permanent blacklisting and legal action under IPC Sections 415, 417, 420 and the IT Act, 2000. Mediseller maintains full dispatch records, packing photos, and courier proofs.</p>
                      <p style="margin-bottom: 12px;">14. <b>Third-Party Platform Complaints:</b> Complaints raised on IndiaMart, TradeIndia, or any third-party platform without first contacting Mediseller support are invalid. Allow 48 working hours for resolution before any escalation.</p>
                      <p style="margin-bottom: 12px;">15. <b>Limitation of Liability:</b> Mediseller's liability is strictly limited to the order value. Mediseller is not liable for indirect losses, health consequences from product use, courier failures, or customs issues. Mediseller is not a medical advisor.</p>
                      <p style="margin-bottom: 12px;">16. <b>Governing Law & Contact:</b> These Terms are governed by Indian law. Disputes subject to exclusive jurisdiction of courts in New Delhi, India. For support: support@mediseller.com | WhatsApp: +91-9667733026 | Mon–Sat, 10 AM – 6:30 PM IST.</p>
                    </div>
                `, "bot");
                break;

            default:

                updateChatUI(
                    option,
                    "bot"
                );
        }

    }, 500);

}

// ===============================
// TICKET CATEGORY
// ===============================

async function selectTicketCategory(category) {

    selectedTicketCategory = category;

    // Any Other
    if (category === "Any Other") {

        isAnyOtherTicket = true;

        conversationState = "awaiting_ticket";

        updateChatUI(
            "✍️ Please describe your issue.",
            "bot"
        );

        return;
    }

    // Disable all ticket buttons after one click
    document
    .querySelectorAll(".ticket-btn")
    .forEach(btn => btn.disabled = true);

    // If it requires photo upload (Incomplete Order, Damaged Product, Product Expiry)
    if (category === "Incomplete Order" || category === "Damaged Product" || category === "Product Expiry") {
        uploadedPhotoUrl = ""; // Reset
        updateChatUI(`
<b>Please upload a photo for your ${category} ticket:</b><br><br>

<div class="upload-box"
style="
margin-top:10px;
padding:15px;
border:2px dashed #d10000;
border-radius:12px;
background:#fff8f8;
text-align:center;
">

<input
type="file"
id="ticketPhotoInput"
accept="image/*"
style="display:none;"
onchange="uploadTicketPhoto(this)"
>

<input
type="file"
id="ticketCameraInput"
accept="image/*"
capture="environment"
style="display:none;"
onchange="uploadTicketPhoto(this)"
>

<div
style="
display:flex;
justify-content:center;
gap:10px;
flex-wrap:wrap;
">

<label
for="ticketPhotoInput"
class="upload-label"
style="
padding:10px 18px;
background:#d10000;
color:#fff;
border-radius:20px;
cursor:pointer;
font-weight:bold;
">
🖼️ Select Photo
</label>

<label
for="ticketCameraInput"
class="upload-label"
style="
padding:10px 18px;
background:#198754;
color:#fff;
border-radius:20px;
cursor:pointer;
font-weight:bold;
">
📷 Take Photo
</label>

</div>

<div
id="previewContainer"
style="
display:none;
margin-top:15px;
">

<img
id="previewImage"
style="
max-width:220px;
border-radius:10px;
border:1px solid #ddd;
">

<br><br>

<button
class="ticket-btn"
onclick="removePhoto()">
❌ Remove Photo
</button>

</div>

<div
id="photoStatus"
style="
margin-top:12px;
font-size:13px;
font-weight:600;
color:#666;
">

No file selected

</div>

<br>

<button

id="submitTicketBtn"

class="ticket-btn"

style="
width:100%;
padding:12px;
border:none;
border-radius:10px;
background:linear-gradient(180deg,#ff3b3b,#d10000);
color:white;
font-weight:bold;
cursor:pointer;
"

disabled

onclick="submitTicketWithPhoto()">

Submit Ticket

</button>

</div>
`, "bot");
        return;
    }

    isAnyOtherTicket = false;

    try {

        const response = await fetch(
            `${API_URL}/create-ticket`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mobile: userMobile,
                    category: category,
                    issue: ""
                })
            }
        );

        const data = await response.json();

        if (data.status === "success") {
            let successMsg = `✅ Ticket created successfully.<br><br>
                <b>Category:</b> ${category}<br><br>`;
            
            if (category === "Advance Paid but Order Not Received") {
                successMsg += `<div style="background: #fff8f8; border-left: 4px solid #d10000; padding: 12px; margin: 12px 0; border-radius: 8px; font-size: 13px; color: #444444; line-height: 1.5; text-align: left; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                    <b>Please note:</b> If your order was placed recently, it may take up to 48 hours for the tracking ID to be generated, provided there are no issues with your order such as address errors, product price discrepancies, or stock unavailability. We request you to kindly wait during this time.
                </div><br>`;
            }
            
            successMsg += `Our support team will contact you shortly.`;

            updateChatUI(successMsg, "bot");

        } else {

            updateChatUI(
                "❌ Unable to create ticket.",
                "bot"
            );

        }

    } catch (e) {

        updateChatUI(
            "❌ Unable to create ticket.",
            "bot"
        );

    }

    selectedTicketCategory = "";
    conversationState = "idle";

}

async function uploadTicketPhoto(input) {
const file = input.files[0];

if (!file) return;

const reader = new FileReader();

reader.onload = function (e) {

    document.getElementById("previewContainer").style.display = "block";

    document.getElementById("previewImage").src = e.target.result;

};

reader.readAsDataURL(file);
   

    const statusEl = document.getElementById("photoStatus");
    const submitBtn = document.getElementById("submitTicketBtn");
    
    statusEl.textContent = "Uploading...";
    statusEl.style.color = "#666666";
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch(`${API_URL}/upload-photo`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if (data.status === "success") {
            uploadedPhotoUrl = data.url;
            statusEl.textContent = "✅ Uploaded successfully!";
            statusEl.style.color = "#2ecc71";
            submitBtn.disabled = false;
        } else {
            statusEl.textContent = "❌ Upload failed: " + (data.message || "Unknown error");
            statusEl.style.color = "#d10000";
            submitBtn.disabled = true;
        }
    } catch (err) {
        console.error(err);
        statusEl.textContent = "❌ Upload failed.";
        statusEl.style.color = "#d10000";
        submitBtn.disabled = true;
    }
}
function removePhoto(){

uploadedPhotoUrl="";

document.getElementById("ticketPhotoInput").value="";

document.getElementById("ticketCameraInput").value="";

document.getElementById("previewContainer").style.display="none";
document.getElementById("previewImage").src = "";

document.getElementById("photoStatus").innerHTML="No file selected";

document.getElementById("submitTicketBtn").disabled=true;

}
async function submitTicketWithPhoto() {
    if (!uploadedPhotoUrl) {
        alert("Please upload a photo first.");
        return;
    }
    
    const submitBtn = document.getElementById("submitTicketBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
    }

    try {
        const response = await fetch(
            `${API_URL}/create-ticket`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mobile: userMobile,
                    category: selectedTicketCategory,
                    issue:"", 
                    photo_url: uploadedPhotoUrl}
                )
            }
        );

        const data = await response.json();

        if (data.status === "success") {
            updateChatUI(
                `✅ Ticket created successfully.<br><br>
                <b>Category:</b> ${selectedTicketCategory}<br>
                <b>Photo:</b> <a href="${uploadedPhotoUrl}" target="_blank" style="color:#d10000;text-decoration:underline;">View Uploaded Photo</a><br><br>
                Our support team will contact you shortly.`,
                "bot"
            );
        } else {
            updateChatUI(
                "❌ Unable to create ticket.",
                "bot"
            );
        }
    } catch (e) {
        updateChatUI(
            "❌ Unable to create ticket.",
            "bot"
        );
    }

    uploadedPhotoUrl = "";
    selectedTicketCategory = "";
    conversationState = "idle";
}

async function fetchOrdersForReorder(mobile) {
    try {
        updateChatUI("🔍 Searching for your orders...", "bot");
        
        const response = await fetch(`${API_URL}/get-orders`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mobile: mobile
            })
        });

        const data = await response.json();
        
        // Remove search loading message
        const messages = document.querySelectorAll(".bot-message");
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.innerText === "🔍 Searching for your orders...") {
            lastMessage.remove();
        }

        if (!data.found || !data.orders || data.orders.length === 0) {
            updateChatUI("❌ No orders found for this mobile number.", "bot");
            conversationState = "idle";
            return;
        }

        availableOrdersToReorder = data.orders;
        
        let msgHtml = `📦 <b>Your Recent Orders:</b><br><br>`;
        availableOrdersToReorder.forEach((order, index) => {
            const statusCapitalized = (order.dispatch_status || "Pending")
                .split(" ")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
            
            msgHtml += `<b>[${index + 1}] Order ID:</b> ${order.order_no}<br>` +
                       `🚚 <b>Courier:</b> ${order.logistic_name || "N/A"}<br>` +
                       `📦 <b>Status:</b> ${statusCapitalized}<br><br>`;
        });
        
        msgHtml += `Please reply with the number (e.g., <b>1</b> or <b>2</b>) of the order you want to reorder.`;
        
        updateChatUI(msgHtml, "bot");
        conversationState = "awaiting_reorder_position";

    } catch (err) {
        console.error(err);
        const messages = document.querySelectorAll(".bot-message");
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.innerText === "🔍 Searching for your orders...") {
            lastMessage.remove();
        }
        updateChatUI("❌ Unable to fetch order details.", "bot");
        conversationState = "idle";
    }
}

async function fetchLatestOrder() {

    try {

        updateChatUI(
            "🔍 Fetching your latest order...",
            "bot"
        );

        const response = await fetch(
            `${API_URL}/track-order`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    mobile: userMobile
                })
            }
        );

        const data = await response.json();
        const messages =
        document.querySelectorAll(".bot-message");

        const lastMessage =
        messages[messages.length - 1];

        if (
        lastMessage &&
        lastMessage.innerText === "🔍 Fetching your latest order..."
        ){
        lastMessage.remove();
        }

        if (!data.found) {

            hasViewedOrder = true;
            conversationState = "idle";
            updateChatUI(
                "❌ No order found for this mobile number.",
                "bot"
            );

            return;

        }

        updateChatUI(

`📦 <b>Order Details</b><br><br>

🆔 <b>Order ID:</b><br>
${data.order_no}<br><br>

🚚 <b>Courier:</b><br>
${data.logistic_name || "Not Available"}<br><br>

📦 <b>Status:</b><br>
${
(data.dispatch_status || "Not Available")
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}<br><br>

🔗 <b>Track Parcel:</b><br>

${
data.tracking_url
?
`<a href="${data.tracking_url}"
target="_blank"
style="
color:#d10000;
text-decoration:underline;
word-break:break-all;
">
${data.tracking_url}
</a>`
:
"Not Available"
}

<br><br>

📌 <b>Delivery Type:</b><br>
${data.delivery_type||"Not Available"}<br><br>

✅ <b>Order Confirmation:</b><br>
${data.order_confirmation||"Pending"}

`,
"bot"
        );
    hasViewedOrder = true;
    conversationState = "idle";

    }

catch(e){

    const messages =
        document.querySelectorAll(".bot-message");

    const lastMessage =
        messages[messages.length - 1];

    if(
        lastMessage &&
        lastMessage.innerText === "🔍 Fetching your latest order..."
    ){
        lastMessage.remove();
    }

    updateChatUI(
        "❌ Unable to fetch order details.",
        "bot"
    );

}

}

// ===============================
// PAGE LOAD
// ===============================

document.addEventListener("DOMContentLoaded", () => {

    updateChatUI(
        "Welcome to Mediseller Support 👋\n\nPlease enter your 10-digit mobile number to continue.",
        "bot"
    );

    const input = document.getElementById("userInput");

    input.addEventListener("keydown", function (e) {

        if (e.key === "Enter") {
            e.preventDefault();
            sendMessage();

        }

    });

});

