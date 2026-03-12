import json
import os

schema_path = r'c:\Users\Dell\Documents\Code\Solar-Selector\src\data\controllers\SCHEMA.md'
controllers_dir = r'c:\Users\Dell\Documents\Code\Solar-Selector\src\data\controllers'

def get_required_fields(schema_file):
    with open(schema_file, 'r') as f:
        content = f.read()
    
    fields = []
    # Simplified parsing for the specific SCHEMA.md structure
    import re
    matches = re.findall(r'\|\s*`([^`]+)`\s*\|', content)
    # The first few matches are header markers, we want the field names
    for m in matches:
        if m not in ['Field', 'Type', 'Description', 'Required']:
            fields.append(m)
    return list(dict.fromkeys(fields)) # unique fields

required_fields = get_required_fields(schema_path)
print(f"Required fields from SCHEMA.md: {required_fields}")

errors = 0
for filename in os.listdir(controllers_dir):
    if filename.endswith('.json'):
        filepath = os.path.join(controllers_dir, filename)
        with open(filepath, 'r') as f:
            try:
                data = json.load(f)
                for i, entry in enumerate(data):
                    for field in required_fields:
                        if field not in entry:
                            print(f"Error in {filename} [index {i}, id {entry.get('id', 'N/A')}]: Missing field '{field}'")
                            errors += 1
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                errors += 1

if errors == 0:
    print("SUCCESS: All controller files conform to the schema.")
else:
    print(f"FAILED: {errors} errors found.")
    exit(1)
