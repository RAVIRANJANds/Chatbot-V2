const API_URL = "https://chatbot-v2-eqxa.onrender.com";

let conversationState = "awaiting_mobile";
let userMobile = "";
let selectedTicketCategory = "";
let isAnyOtherTicket = false;
let isTrackOrderFlow = false;
let hasViewedOrder = false;
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
        case "awaiting_product":
            try {
                const verifyResponse = await fetch(
                `${API_URL}/verify-order`,
                {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    order_no: text
                })
            }
        );
           const verifyData = await verifyResponse.json();
            if (!verifyData || !verifyData.found) {
                updateChatUI(
                    "❌ Invalid Order ID. Reorder can only be placed for existing orders.",
                    "bot"
                );
            conversationState = "idle";
            break;
        }
        await fetch(
            `${API_URL}/create-reorder`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    order_no: text
                })
            }
        );

        updateChatUI(
            "✅ Re-order request submitted successfully.",
            "bot"
        );

    } catch (e) {

        updateChatUI(
            "❌ Unable to submit reorder request.",
            "bot"
        );

    }

    conversationState = "idle";
    selectedTicketCategory = "";
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

    if (conversationState === "awaiting_mobile" && option !== "FAQs") {

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
                    onclick="selectTicketCategory('Quality Issue')">
                    ⭐ Quality Issue
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

                conversationState = "awaiting_product";

                updateChatUI(
                    "Please enter your correct Order No:",
                    "bot"
                );

                break;

            case "FAQs":

                updateChatUI(
                    "Please click FAQ section. Dynamic FAQ API can be connected later.",
                    "bot"
                );

                break;

            case "WhatsApp Support":

                const salesNumber = "917065016950";

                const salesMessage = encodeURIComponent(
                    `Hello, My Mobile Number is ${userMobile}. I need support.`
                );

                window.open(
                    `https://wa.me/${salesNumber}?text=${salesMessage}`,
                    "_blank"
                );

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

    // Normal Categories
    isAnyOtherTicket = false;
    // Disable all ticket buttons after one click
    document
    .querySelectorAll(".ticket-btn")
    .forEach(btn => btn.disabled = true);

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

            updateChatUI(
                `✅ Ticket created successfully.<br><br>
                <b>Category:</b> ${category}<br><br>
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

    selectedTicketCategory = "";
    conversationState = "idle";

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
color:#ffffff;
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

