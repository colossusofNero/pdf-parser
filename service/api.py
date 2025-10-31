from __future__ import annotations

import os, json
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.quote_calc import QuoteCalculator
from .schemas import QuoteInputs, QuoteResult, QuoteDoc 

# -------- App & engine setup --------
XLSX_PATH = r"C:\Users\scott\Claude_Code\Online_quote_RCGV\Base Pricing27.1_Pro_SMART_RCGV.xlsx"  # adjust if needed
calc = QuoteCalculator(XLSX_PATH)

app = FastAPI(title="RCGV Quote Tools", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# In-memory draft (swap to Supabase later)
CURRENT_DRAFT: Dict[str, Any] = {}

# -------- Quote API --------
@app.post("/quote/set_inputs")
def set_inputs(payload: Dict[str, Any]):
    global CURRENT_DRAFT
    CURRENT_DRAFT.update(payload or {})
    try:
        QuoteInputs(**CURRENT_DRAFT)  # optional validation
    except Exception:
        pass
    return {"ok": True, "draft": CURRENT_DRAFT}

@app.get("/quote/get_inputs")
def get_inputs():
    return {"draft": CURRENT_DRAFT}

@app.post("/quote/compute", response_model=QuoteResult)
def compute_quote(inp: QuoteInputs):
    base, _parts = calc.nat_log_quote(
        purchase_price=inp.purchase_price,
        land_value=inp.land_value,
        known_land_value=inp.known_land_value,
        zip_code=inp.zip_code
    )
    final, breakdown = calc.final_quote(
        purchase_price=inp.purchase_price,
        land_value=inp.land_value,
        known_land_value=inp.known_land_value,
        zip_code=inp.zip_code,
        rush_label=inp.rush,
        premium=inp.premium,
        referral=inp.referral,
        price_override=inp.price_override
    )
    return QuoteResult(base_quote=round(base, 2), final_quote=final, parts=breakdown)

@app.post("/quote/save_draft")
def save_draft():
    return {"ok": True, "draft": CURRENT_DRAFT}

@app.get("/quote/load_draft")
def load_draft():
    return {"ok": True, "draft": CURRENT_DRAFT}

# -------- AgentKit + ChatKit (lazy OpenAI client) --------
from openai import OpenAI

def get_openai_client():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")
    return OpenAI(api_key=key)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "quote_set_inputs",
            "description": "Upsert any provided quote inputs into the working draft.",
            "parameters": {
                "type": "object",
                "properties": {
                    "purchase_price": {"type": "number"},
                    "zip_code": {"type": "integer"},
                    "land_value": {"type": "number", "description": "Percent if known_land_value=false, dollars if True"},
                    "known_land_value": {"type": "boolean"},
                    "property_type": {"type": "string"},
                    "sqft_building": {"type": "number"},
                    "acres_land": {"type": "number"},
                    "floors": {"type": "integer"},
                    "multiple_properties": {"type": "integer"},
                    "purchase_date": {"type": "string", "format": "date"},
                    "tax_year": {"type": "integer"},
                    "pad_deferred_growth": {"type": "boolean"},
                    "is_1031": {"type": "string", "enum": ["Yes","No"]},
                    "capex": {"type": "string", "enum": ["Yes","No"]},
                    "capex_amount": {"type": "number"},
                    "capex_date": {"type": "string", "format": "date"},
                    "price_override": {"type": "number"},
                    "rush": {"type": "string", "enum": ["No Rush","4W $500","2W $1000"]},
                    "premium": {"type": "string", "enum": ["Yes","No"]},
                    "referral": {"type": "string", "enum": ["Yes","No"]}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "quote_compute",
            "description": "Compute the quote using provided inputs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "purchase_price": {"type": "number"},
                    "zip_code": {"type": "integer"},
                    "land_value": {"type": "number"},
                    "known_land_value": {"type": "boolean"},
                    "rush": {"type": "string", "enum": ["No Rush","4W $500","2W $1000"]},
                    "premium": {"type": "string", "enum": ["Yes","No"]},
                    "referral": {"type": "string", "enum": ["Yes","No"]},
                    "price_override": {"type": "number"}
                },
                "required": ["purchase_price","zip_code","land_value","known_land_value"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are RCGV’s quoting assistant for cost segregation.

Workflow:
1) If you have purchase_price, zip_code, land_value, known_land_value → call quote_compute.
2) Otherwise, ask for only the missing fields (one question at a time).

Response format (always):
- Title line: **RCGV Quote**
- Two bullets showing Base and Final as $X,XXX.XX
- A compact breakdown list:
  - Cost basis, cb_factor, zip_factor
  - Adjustments (Rush, Premium %, Referral %, Override if present)
- A single follow-up question like: “Want to toggle Rush (No Rush / 4W $500 / 2W $1000) or Premium (Yes/No)?”

Rules:
- If land is a percent, set known_land_value=False; if a dollar value, set known_land_value=True.
- Validate zip (00000–99999) and land percent (0–1).
- Be concise, businesslike, no fluff.
"""

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]  # [{"role":"user","content":"..."}]

def _tool_quote_set_inputs(args: Dict[str, Any]) -> Dict[str, Any]:
    global CURRENT_DRAFT
    CURRENT_DRAFT.update(args or {})
    return {"ok": True, "draft": CURRENT_DRAFT}

def _tool_quote_compute(args: Dict[str, Any]) -> Dict[str, Any]:
    payload = {**CURRENT_DRAFT, **(args or {})}
    qi = QuoteInputs(**payload)
    base, _parts = calc.nat_log_quote(
        purchase_price=qi.purchase_price,
        land_value=qi.land_value,
        known_land_value=qi.known_land_value,
        zip_code=qi.zip_code
    )
    final, breakdown = calc.final_quote(
        purchase_price=qi.purchase_price,
        land_value=qi.land_value,
        known_land_value=qi.known_land_value,
        zip_code=qi.zip_code,
        rush_label=qi.rush,
        premium=qi.premium,
        referral=qi.referral,
        price_override=qi.price_override
    )
    return {"base_quote": round(base, 2), "final_quote": final, "parts": breakdown}

_TOOL_REGISTRY = {
    "quote_set_inputs": _tool_quote_set_inputs,
    "quote_compute": _tool_quote_compute,
}

@app.post("/agent/chat")
def agent_chat(req: ChatRequest):
    client = get_openai_client()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + req.messages

    # seed known draft so the model knows what we already have
    if CURRENT_DRAFT:
        messages.insert(1, {
            "role": "system",
            "content": f"Current known inputs (JSON): {json.dumps(CURRENT_DRAFT)}"
        })

    # loop tool-calls until final answer
    for _ in range(6):
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )
        choice = resp.choices[0]
        msg = choice.message

        if getattr(msg, "tool_calls", None):
            # record assistant msg with tool calls
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {"id": tc.id, "type":"function",
                     "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in msg.tool_calls
                ]
            })
            # execute tools and append tool results
            for tc in msg.tool_calls:
                name = tc.function.name
                args = json.loads(tc.function.arguments or "{}")
                fn = _TOOL_REGISTRY.get(name)
                tool_out = {"error": f"Unknown tool {name}"} if not fn else fn(args)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": name,
                    "content": json.dumps(tool_out)
                })
            continue

        # no tool calls → final reply
        return {"reply": msg.content, "draft": CURRENT_DRAFT}

    return {"reply": "I hit the tool-call step limit. Please try again with more detail."}

@app.get("/agent/envcheck")
def envcheck():
    return {"has_key": bool(os.environ.get("OPENAI_API_KEY"))}

@app.get("/")
def root():
    return {"ok": True, "service": "RCGV Quote API", "docs": "/docs", "chat": "/agent/chat"}

# ---- helper for pydantic v1/v2 ----
def _to_dict(m: BaseModel) -> Dict[str, Any]:
    return m.model_dump() if hasattr(m, "model_dump") else m.dict()

# ---- Quote document route ----
@app.post("/quote/document", response_model=QuoteDoc)
def quote_document(inp: QuoteInputs):
    base, _ = calc.nat_log_quote(
        purchase_price=inp.purchase_price,
        land_value=inp.land_value,
        known_land_value=inp.known_land_value,
        zip_code=inp.zip_code
    )
    final, parts = calc.final_quote(
        purchase_price=inp.purchase_price,
        land_value=inp.land_value,
        known_land_value=inp.known_land_value,
        zip_code=inp.zip_code,
        rush_label=inp.rush,
        premium=inp.premium,
        referral=inp.referral,
        price_override=inp.price_override
    )

    payload = calc.build_quote_doc(
        inputs=_to_dict(inp),                            # <-- use helper
        final_quote_amount=final,
        rush_fee=parts.get("rush_fee", 0.0)
    )
    payload["rcg_contact_name"] = "Scott Roelofs"
    payload["rcg_contact_office"] = "331.248.7245"
    payload["rcg_contact_cell"]   = "480.276.5626"
    payload["rcg_contact_email"]  = "info@rcgvaluation.com"
    payload["rcg_contact_site"]   = "rcgvaluation.com"
    payload["rcg_address"]        = "6929 N Hayden Rd Suite C4-494, Scottsdale, AZ 85250"
    return payload
