// ===============================
// API URL
// ===============================

const API_URL = "https://mediseller-chatbot.onrender.com";

// ===============================
// STATE TRACKER
// ===============================

let conversationState = "awaiting_mobile";
let userMobile = "";

// ===============================
// SAVE DATA TO BACKEND
// ===============================

async function saveToBackend(data) {

    try {

        await fetch(`${API_URL}/save-data`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

    } catch (err) {

        console.error(err);

    }

}

// ===============================
// MESSAGE UI
// ===============================

function createMessage(text, sender) {

    const chatBody = document.getElementById("chatBody");

    const div = document.createElement("div");

    div.className =
        sender === "user"
            ? "user-message"
            : "bot-message";

    div.innerText = text;

    chatBody.appendChild(div);

    chatBody.scrollTop = chatBody.scrollHeight;

}

function updateChatUI(text, sender) {

    createMessage(text, sender);

}

// ===============================
// SEND MESSAGE
// ===============================

async function sendMessage() {

    const input = document.getElementById("userInput");

    const text = input.value.trim();

    if (!text) return;

    updateChatUI(text, "user");

    // ---------------------------
    // MOBILE VERIFICATION
    // ---------------------------

    if (conversationState === "awaiting_mobile") {

        const mobileRegex = /^[6-9]\d{9}$/;

        if (!mobileRegex.test(text)) {

            updateChatUI(
                "Please enter a valid 10-digit mobile number.",
                "bot"
            );

            input.value = "";
            return;
        }

        userMobile = text;

        await saveToBackend({
            mobile: userMobile,
            query: "Mobile Verified"
        });

        updateChatUI(
            "Mobile number verified successfully.\n\nHow can we help you today?",
            "bot"
        );

        conversationState = "idle";

        input.value = "";
        return;
    }

    // ---------------------------
    // SAVE CHAT
    // ---------------------------

    await saveToBackend({
        mobile: userMobile,
        query: text
    });

    // ---------------------------
    // STATES
    // ---------------------------

    switch (conversationState) {

        case "awaiting_order_id":

            try {

                const response = await fetch(
                     `${API_URL}/track-order`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            order_id: text
                        })
                    }
                );

                const data = await response.json();

                if (data.found) {

                    updateChatUI(
`✅ Order Found

Order No: ${data.order_no}

Client Name: ${data.client_name}

Contact Number: ${data.contact_number}

Order Details:
${data.order_details}

Total Amount: ₹${data.total_amount}`,
                        "bot"
                    );

                } else {

                    updateChatUI(
                        "❌ Order not found.",
                        "bot"
                    );

                }

            } catch (error) {

                updateChatUI(
                    "❌ Unable to fetch order details.",
                    "bot"
                );

            }

            conversationState = "idle";
            break;

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

function selectOption(option) {

    if (conversationState === "awaiting_mobile" && option !== "FAQs")
         {

        updateChatUI(
            "Please enter your mobile number first.",
            "bot"
        );

        return;
    }

    updateChatUI(option, "user");

    saveToBackend({
        mobile: userMobile,
        query: option
    });

    setTimeout(() => {

        switch (option) {

            case "Track My Order":

                updateChatUI(
                    "Please enter your Order No:",
                    "bot"
                );

                conversationState = "awaiting_order_id";

                break;

            case "Raise a Ticket":

                updateChatUI(
                    "Please describe your issue:",
                    "bot"
                );

                conversationState = "awaiting_ticket";

                break;

            case "Product Reorder":

                updateChatUI(
                    "Please enter correct Order No :",
                    "bot"
                );

                conversationState = "awaiting_product";

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

