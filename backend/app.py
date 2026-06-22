from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime

app = Flask(__name__)
CORS(app)

# ==================================
# GOOGLE SHEET CONFIG
# ==================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

SHEET_ID = "1UyvjshQcX7GR_IWao82dGTZ0IaGfktQMoFB0XmVIPIE"

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


# ==================================
# SAVE CHAT DATA
# ==================================

@app.route("/save-data", methods=["POST"])
def save_data():

    try:

        data = request.json

        mobile = data.get("mobile", "")
        query = data.get("query", "")

        sheet = get_sheet("Bot event")

        sheet.append_row([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            mobile,
            query
        ])

        return jsonify({
            "status": "success"
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


# ==================================
# TRACK ORDER
# ==================================

@app.route("/track-order", methods=["POST"])
def track_order():

    try:

        data = request.json

        order_no = str(
            data.get("order_id", "")
        ).strip().upper()

        sheet = get_sheet("Master sheet")

        records = sheet.get_all_records()

        for row in records:

            current_order = str(
                row.get("Order No", "")
            ).strip().upper()

            if current_order == order_no:

                return jsonify({
                    "found": True,
                    "order_no": row.get("Order No", ""),
                    "client_name": row.get("Client Name", ""),
                    "contact_number": row.get("Contact Number", ""),
                    "order_details": row.get("Order Details", ""),
                    "total_amount": row.get("Total Amount", ""),
                    "poc": row.get("POC", ""),
                    "client_type": row.get("Client Type", "")
                })

        return jsonify({
            "found": False
        })

    except Exception as e:

        return jsonify({
            "found": False,
            "error": str(e)
        })


# ==================================
# CREATE TICKET
# ==================================

@app.route("/create-ticket", methods=["POST"])
def create_ticket():

    try:

        data = request.json

        mobile = data.get("mobile", "")
        issue = data.get("issue", "")

        sheet = get_sheet("Ticket")

        sheet.append_row([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            mobile,
            issue,
            "Open"
        ])

        return jsonify({
            "status": "success"
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "error": str(e)
        })


# ==================================
# CREATE REORDER
# ==================================

@app.route("/create-reorder", methods=["POST"])
def create_reorder():

    try:

        data = request.json

        order_no = data.get("order_no", "")

        sheet = get_sheet("Re-orders")

        sheet.append_row([
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            order_no
        ])

        return jsonify({
            "status": "success"
        })

    except Exception as e:

        return jsonify({
            "status": "error",
            "error": str(e)
        })


# ==================================
# GET FAQ
# ==================================

@app.route("/faq", methods=["GET"])
def get_faq():

    try:

        sheet = get_sheet("FAQ")

        records = sheet.get_all_records()

        return jsonify(records)

    except Exception as e:

        return jsonify({
            "status": "error",
            "error": str(e)
        })


# ==================================
# HEALTH CHECK
# ==================================

@app.route("/")
def home():

    return jsonify({
        "status": "running",
        "message": "Mediseller Chatbot API Running"
    })


# ==================================
# RUN APP
# ==================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )