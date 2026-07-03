from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import google.generativeai as genai

from pydantic import BaseModel

# ==========================
# REQUEST MODELS
# ==========================

class SaveDataRequest(BaseModel):
    session_id: str
    mobile: str = ""
    query: str = ""

class OrderRequest(BaseModel):
    mobile: str

class TicketRequest(BaseModel):
    mobile: str
    category: str
    issue: str = " "

class VerifyOrderRequest(BaseModel):
    order_no: str

class ReorderRequest(BaseModel):
    order_no: str

class ChatRequest(BaseModel):
    message: str
# ==================================
# FASTAPI APP
# ==================================

app = FastAPI(
    title="Mediseller Chatbot API",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Production me domain specify karna
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================================
# GOOGLE SHEET CONFIG
# ==================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SHEET_ID = "1UyvjshQcX7GR_IWao82dGTZ0IaGfktQMoFB0XmVIPIE"

if os.path.exists("/etc/secrets/credentials.json"):
    CREDS_FILE = "/etc/secrets/credentials.json"
else:
    CREDS_FILE = os.path.join(
        BASE_DIR,
        "Data",
        "credentials.json"
    )

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

try:

    creds = Credentials.from_service_account_file(
        CREDS_FILE,
        scopes=SCOPES
    )

    client = gspread.authorize(creds)

    spreadsheet = client.open("Testing dom data")

    print("\n========== CONNECTED ==========")
    print("Spreadsheet:", spreadsheet.title)

    print("\nAvailable Sheets:")

    for ws in spreadsheet.worksheets():
        print("-", ws.title)

    print("===============================\n")

except Exception as e:

    print("\nGOOGLE SHEET CONNECTION ERROR\n")
    print(e)
    raise e


def get_sheet(sheet_name):
    return spreadsheet.worksheet(sheet_name)

 #==================================
# SAVE CHAT DATA
# ==================================

@app.post("/save-data")
async def save_data(data: SaveDataRequest):

    try:

        sheet = get_sheet("Bot event")

        records = sheet.get_all_values()

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Skip Header Row
        for i in range(1, len(records)):

            if len(records[i]) > 1 and str(records[i][1]).strip() == str(data.session_id).strip():

                old_chat = ""

                if len(records[i]) >= 4:
                    old_chat = records[i][3]

                new_chat = old_chat.strip()

                if new_chat:
                    new_chat += "\n" + data.query
                else:
                    new_chat = data.query

                sheet.update_cell(i + 1, 1, timestamp)
                sheet.update_cell(i + 1, 4, new_chat)

                return {
                    "status": "updated"
                }

        # New Session
        sheet.append_row([
            timestamp,
            data.session_id,
            data.mobile,
            data.query
        ])

        return {
            "status": "created"
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    


@app.post("/track-order")
async def track_order(data: OrderRequest):

    try:

        mobile = str(data.mobile).strip().upper()

        print("\n=================================")
        print("User Mobile :", mobile)

        sheet = get_sheet("Master sheet")
        records = sheet.get_all_records()

        print("Headers :", records[0].keys())
        print("First Row :", records[0])

        latest_order = None

        for row in records:

            current_mobile = str(
                row.get("Mobile", "")
            ).strip().upper()

            print("---------------------------------")
            print("Sheet Mobile :", current_mobile)
            print("User Mobile  :", mobile)

            if current_mobile == mobile:

                print("✅ MATCH FOUND")

                latest_order = row

        print("Latest Order :", latest_order)

        if latest_order:

            return {
                "found": True,
                "order_no": latest_order.get("Order No", ""),
                "dispatch_status": latest_order.get("Dispatch Status", "").strip().lower(),
                "tracking_number": latest_order.get("Tracking Number", ""),
                "tracking_url": latest_order.get("Tracking Url", ""),
                "logistic_name": latest_order.get("Logistic Name", ""),
                "delivery_type": latest_order.get("Delivery Type", ""),
                "order_confirmation": latest_order.get("Order Confirmation Status", ""),
                "courier_type": latest_order.get("Order Type", "")
            }

        print("❌ NO MATCH FOUND")

        return {
            "found": False
        }

    except Exception as e:

        print("ERROR :", e)

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
@app.post("/create-ticket")
async def create_ticket(data: TicketRequest):

    try:

        sheet = get_sheet("Ticket")

        sheet.append_row([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            data.mobile,
            data.category,
            data.issue,
            "Open"
        ])

        return {
            "status": "success"
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
@app.post("/verify-order")
async def verify_order(data: VerifyOrderRequest):

    try:

        order_no = str(data.order_no).strip().upper()

        sheet = get_sheet("Master sheet")

        records = sheet.get_all_records()

        for row in records:

            current_order = str(
                row.get("Order No", "")
            ).strip().upper()

            if current_order == order_no:

                return {
                    "found": True
                }

        return {
            "found": False
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
    
@app.post("/create-reorder")
async def create_reorder(data: ReorderRequest):

    try:

        sheet = get_sheet("Re-orders")

        sheet.append_row([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            data.order_no
        ])

        return {
            "status": "success"
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
@app.get("/faq")
async def get_faq():

    try:

        sheet = get_sheet("FAQ")

        records = sheet.get_all_records()

        return records

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


genai.configure(
    api_key=os.getenv("GEMINI_API_KEY")
)
@app.post("/chat-ai")
async def chat_ai(data: ChatRequest):

    try:

        model = genai.GenerativeModel(
            "gemini-2.0-flash"
        )

        prompt = f"""
        You are Mediseller Support Assistant.

        Company: Mediseller Pharma

        Rules:
        - Reply professionally.
        - Keep answers short.
        - If user wants order status, ask them to use Track My Order.
        - If user wants ticket support, ask them to use Raise a Ticket.
        - If user wants reorder, ask them to use Product Reorder.
        - Reply in the same language as the user.

        User:
        {data.message}
        """

        response = model.generate_content(prompt)

        return {
            "reply": response.text
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
@app.get("/")
async def home():

    return {
        "status": "running",
        "message": "Mediseller Chatbot API Running"
    }#