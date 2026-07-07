from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import shutil
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime
import google.generativeai as genai
from fastapi import Request
from dotenv import load_dotenv

load_dotenv()

def normalize_phone(phone_str):
    s = str(phone_str).strip()
    if s.endswith(".0"):
        s = s[:-2]
    s = "".join(c for c in s if c.isdigit())
    if len(s) >= 10:
        return s[-10:]
    return s

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
    issue: str = ""
    photo_url: str = ""

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

UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

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
        user_mobile_norm = normalize_phone(mobile)

        print("\n=================================")
        print("User Mobile :", mobile)

        sheet = get_sheet("Master sheet")
        records = sheet.get_all_records()

        print("Headers :", records[0].keys())
        print("First Row :", records[0])

        latest_order = None

        for row in records:

            current_mobile = normalize_phone(row.get("Mobile", ""))

            print("---------------------------------")
            print("Sheet Mobile :", current_mobile)
            print("User Mobile  :", user_mobile_norm)

            if current_mobile == user_mobile_norm:

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

@app.post("/get-orders")
async def get_orders(data: OrderRequest):
    try:
        mobile = str(data.mobile).strip().upper()
        user_mobile_norm = normalize_phone(mobile)
        sheet = get_sheet("Master sheet")
        records = sheet.get_all_records()
        user_orders = []
        for row in records:
            current_mobile = normalize_phone(row.get("Mobile", ""))
            if current_mobile == user_mobile_norm:
                user_orders.append({
                    "order_no": str(row.get("Order No", "")),
                    "logistic_name": str(row.get("Logistic Name", "")),
                    "dispatch_status": str(row.get("Dispatch Status", "")).strip(),
                    "tracking_number": str(row.get("Tracking Number", "")),
                    "tracking_url": str(row.get("Tracking Url", "")),
                    "delivery_type": str(row.get("Delivery Type", "")),
                    "order_confirmation": str(row.get("Order Confirmation Status", "")),
                    "courier_type": str(row.get("Order Type", ""))
                })
        if user_orders:
            user_orders.reverse()  # Latest first
            return {
                "found": True,
                "orders": user_orders
            }
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
        master_sheet = get_sheet("Master sheet")
        records = master_sheet.get_all_records()

        customer = None

        # Find customer by mobile
        for row in records:
            if normalize_phone(row.get("Mobile", "")) == normalize_phone(data.mobile):
                customer = row
                break

        if not customer:
            raise HTTPException(
                status_code=404,
                detail="Customer not found in Master Sheet"
            )

        ticket_id = "TKT" + datetime.now().strftime("%Y%m%d%H%M%S")
        created_on = datetime.now().strftime("%d %b %Y, %I:%M %p")

        print("========== CREATE TICKET ==========")
        print("Worksheet :", sheet.title)
        print("Customer :", customer)

        row_data = [
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),   # Timestamp
            customer.get("Mobile", ""),                     # Mobile
            ticket_id,                                      # Ticket ID
            data.category,                                  # Category
            data.issue,                                     # Issue
            data.photo_url,                                 # Photo URL
            "Open",                                         # Status
            data.issue,                                     # Description
            "Website",                                      # Source
            customer.get("Order No", ""),                   # Remark
            "Pending",                                      # Ticket Status
            "",                                             # Next Followup
            customer.get("Dispatch Status", "")             # Final Remark
        ]

        print("ROW DATA :", row_data)

        sheet.append_row(
            row_data,
            value_input_option="USER_ENTERED"
        )

        print("Row Saved Successfully")

        next_row = len(sheet.get_all_values())

        sheet.update(
            f"F{next_row}",
            [[f'=HYPERLINK("{data.photo_url}","View Photo")']],
            value_input_option="USER_ENTERED"
        )

        print("Photo Link Updated")

        return {
            "status": "success",
            "ticket_id": ticket_id,
            "created_on": created_on,
            "photo_url": data.photo_url
        }

    except Exception as e:

        print("CREATE TICKET ERROR :", repr(e))

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
        master_sheet = get_sheet("Master sheet")
        records = master_sheet.get_all_records()

        customer = None

        # Order No se customer search
        for row in records:
            if str(row.get("Order No", "")).strip() == str(data.order_no).strip():
                customer = row
                break

        if not customer:
            raise HTTPException(
                status_code=404,
                detail="Order not found in Master Sheet"
            )

        reorder_id = "REO" + datetime.now().strftime("%Y%m%d%H%M%S")
        print("Writing to Ticket Sheet...")


        sheet.append_row([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),   # Timestamp
            "",                                             # Ticket ID (Blank)
            reorder_id,                                     # Reorder ID
            customer["Mobile"],                             # Phone
            customer["Client Name"],                        # Name
            customer["Order No"],                           # Last Order ID
            customer["DATE"],                               # Last Order Date
            customer.get("POC", "Web")                         # Source
        ])

        return {
            "status": "success",
            "reorder_id": reorder_id
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


api_key = os.getenv("GEMINI_API_KEY")

print("=" * 50)
print("API KEY FOUND:", bool(api_key))
print("API KEY PREFIX:", api_key[:10] if api_key else "None")
print("=" * 50)

genai.configure(api_key=api_key)
@app.post("/chat-ai")
async def chat_ai(data: ChatRequest):

    try:

        print("User Message:", data.message)

        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(data.message)

        print("Gemini Reply:", response.text)

        return {
            "reply": response.text
        }

    except Exception as e:

        print("Gemini ERROR:", repr(e))

        return {
            "reply": f"ERROR : {str(e)}"
        }
@app.post("/upload-photo")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...)
):
    try:
        filename = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{file.filename}"
        file_location = os.path.join(UPLOAD_DIR, filename)
        with open(file_location, "wb+") as file_object:
            shutil.copyfileobj(file.file, file_object)
        return {
    "status": "success",
    "url": str(request.base_url) + f"static/uploads/{filename}"
}
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

@app.get("/")
async def home():

    return {
        "status": "running",
        "message": "Mediseller Chatbot API Running"
    }#