#!/usr/bin/env python3
import os, re, json, time, imaplib, email, email.utils, requests, pathlib

GH_TOKEN = os.environ["GH_TOKEN"]
GH_REPO  = os.environ["GH_REPO"]
IMAP_HOST= os.environ["IMAP_HOST"]
IMAP_PORT= int(os.environ.get("IMAP_PORT","993"))
IMAP_USER= os.environ["IMAP_USER"]
IMAP_PASS= os.environ["IMAP_PASS"]
INBOX    = os.environ.get("IMAP_FOLDER_INBOX","INBOX")
DONEF    = os.environ.get("IMAP_FOLDER_DONE","Processed")
WL_PATH  = pathlib.Path(os.environ.get("WL_PATH","landing/viewer/whitelist.json"))

SUBJ_RE = re.compile(r'(?:\[DMS[^\]]*?\bjti\s*[:=]\s*([A-Za-z0-9._-]+)[^\]]*\]|\bjti\s*[:=]\s*([A-Za-z0-9._-]+))', re.I)

def gh_headers():
    return {"Authorization": f"token {GH_TOKEN}", "Accept": "application/vnd.github+json"}

def list_pending_issues():
    url = f"https://api.github.com/repos/{GH_REPO}/issues?state=open&per_page=100"
    r = requests.get(url, headers=gh_headers(), timeout=30); r.raise_for_status()
    out=[]
    for it in r.json():
        if "pull_request" in it: 
            continue
        labels = [l["name"] for l in it.get("labels",[])]
        if not any(lb in labels for lb in ("pending-reply","grant-access")):
            continue
        body = it.get("body") or ""
        m = re.search(r'<!--DMS:START-->\s*```json\s*(\{.*?\})\s*```\s*<!--DMS:END-->', body, re.S)
        if not m: 
            continue
        try:
            data = json.loads(m.group(1))
        except Exception:
            continue
        sub = (data.get("sub") or data.get("to") or "").lower()
        jti = data.get("jti") or data.get("token_id") or ""
        exp = int(str(data.get("exp") or 0))
        scope = data.get("scope") or ["news-private"]
        out.append({"number": it["number"], "labels": labels, "sub": sub, "jti": jti, "exp": exp, "scope": scope})
    return out

def load_wl():
    if WL_PATH.exists():
        try: return json.loads(WL_PATH.read_text())
        except: pass
    return {"version":1,"generated_at":"","entries":[]}

def upsert_wl(data, sub, jti, exp, scope):
    now = int(time.time())
    if exp < now: exp = now + 3600
    for e in data["entries"]:
        if (jti and e.get("jti")==jti) or (sub and e.get("sub")==sub):
            e.update({"sub":sub,"jti":jti,"exp":exp,"scope":scope})
            break
    else:
        data["entries"].append({"sub":sub,"jti":jti,"exp":exp,"scope":scope})
    data["generated_at"]=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return data

def imap_connect():
    M = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
    M.login(IMAP_USER, IMAP_PASS)
    return M

def decode_subject(s):
    try:
        parts = email.header.decode_header(s)
        return "".join([(t.decode(enc or "utf-8","ignore") if isinstance(t,bytes) else t) for t,enc in parts])
    except Exception:
        return s or ""

def extract_jti(subj):
    subj = decode_subject(subj)
    m = SUBJ_RE.search(subj or "")
    if m:
        return (m.group(1) or m.group(2) or "").strip()
    return ""

def email_addr(s):
    name, addr = email.utils.parseaddr(s or "")
    return addr.lower()

def move_done(M, uid):
    try: M.create(DONEF)
    except: pass
    try:
        M.uid("COPY", uid, DONEF)
        M.uid("STORE", uid, "+FLAGS", "(\\Seen \\Deleted)")
        M.expunge()
    except: pass

def main():
    issues = list_pending_issues()
    pend_by_jti = { i["jti"]: i for i in issues if i["jti"] }
    pend_by_sub = {}
    for i in issues:
        if i["sub"]: pend_by_sub.setdefault(i["sub"], []).append(i)
    print("Pending issues:", len(issues))

    M = imap_connect()
    M.select(INBOX)
    typ, data = M.uid("search", None, "(UNSEEN)")
    if typ!="OK": 
        print("IMAP search failed"); return
    uids = data[0].split()
    print("UNSEEN:", len(uids))
    wl = load_wl()
    changed=False

    for uid in uids:
        typ, msg_data = M.uid("fetch", uid, "(RFC822)")
        if typ!="OK": continue
        msg = email.message_from_bytes(msg_data[0][1])
        subj = msg.get("Subject","")
        frm  = email_addr(msg.get("From",""))
        jti  = extract_jti(subj)
        print("Mail from", frm, "jti", jti, "subj", decode_subject(subj))

        matched=None
        if jti and jti in pend_by_jti:
            cand = pend_by_jti[jti]
            if (cand["sub"] and cand["sub"]==frm) or not cand["sub"]:
                matched=cand
        else:
            cands = pend_by_sub.get(frm, [])
            if len(cands)==1:
                matched=cands[0]

        if matched:
            wl = upsert_wl(wl, matched["sub"] or frm, matched["jti"] or jti, matched["exp"], matched["scope"])
            changed=True
            num = matched["number"]
            try:
                requests.post(f"https://api.github.com/repos/{GH_REPO}/issues/{num}/labels",
                              headers=gh_headers(), json={"labels":["granted"]}, timeout=20)
                try: requests.delete(f"https://api.github.com/repos/{GH_REPO}/issues/{num}/labels/pending-reply",
                                     headers=gh_headers(), timeout=20)
                except: pass
                requests.post(f"https://api.github.com/repos/{GH_REPO}/issues/{num}/comments",
                              headers=gh_headers(), json={"body":"✅ Auto-unlock: reply detected via IMAP."}, timeout=20)
                requests.patch(f"https://api.github.com/repos/{GH_REPO}/issues/{num}",
                               headers=gh_headers(), json={"state":"closed"}, timeout=20)
            except Exception as e:
                print("Issue update failed:", e)
            move_done(M, uid)
        else:
            # mark seen to avoid reprocessing
            M.uid("STORE", uid, "+FLAGS", "(\\Seen)")

    if changed:
        WL_PATH.parent.mkdir(parents=True, exist_ok=True)
        WL_PATH.write_text(json.dumps(wl, ensure_ascii=False, indent=2))
        print("Whitelist updated.")
    else:
        print("No changes to whitelist.")

    M.logout()

if __name__ == "__main__":
    main()
