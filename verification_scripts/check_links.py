import json
import urllib.request
import urllib.error
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def check_file(filename):
    print(f"Checking {filename}...", flush=True)
    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for item in data:
        url = item.get('datasheetUrl')
        if not url:
            print(f"[{item['id']}] NO URL")
            continue
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            resp = urllib.request.urlopen(req, timeout=10, context=ctx)
            print(f"[{item['id']}] {resp.getcode()} OK")
        except urllib.error.HTTPError as e:
            print(f"[{item['id']}] ERR {e.code}")
        except Exception as e:
            print(f"[{item['id']}] ERR {str(e)}")

check_file('src/data/controllers/victron-energy.json')
check_file('src/data/controllers/voltacon.json')
