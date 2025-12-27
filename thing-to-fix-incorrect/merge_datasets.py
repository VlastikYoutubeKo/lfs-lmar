#!/usr/bin/env python3
"""
Merge multiple ML datasets into one.
"""

import json
import sys
from glob import glob

def merge_datasets(files):
    """Spojí více dataset souborů do jednoho."""
    merged = {
        'exportedAt': None,
        'datasetSize': 0,
        'turnTypes': set(),
        'dataset': []
    }
    
    for filepath in files:
        print(f"📂 Načítám: {filepath}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'dataset' in data:
            merged['dataset'].extend(data['dataset'])
            merged['datasetSize'] += len(data['dataset'])
            
            if 'turnTypes' in data:
                merged['turnTypes'].update(data['turnTypes'])
    
    merged['turnTypes'] = list(merged['turnTypes'])
    
    print(f"\n✅ Spojeno:")
    print(f"  Souborů: {len(files)}")
    print(f"  Celkem příkladů: {merged['datasetSize']}")
    print(f"  Typy zatáček: {', '.join(merged['turnTypes'])}")
    
    return merged

def main():
    if len(sys.argv) < 2:
        print("Usage: python merge_datasets.py <file1.json> <file2.json> ... [-o output.json]")
        print("   Or: python merge_datasets.py ml_dataset_*.json -o combined.json")
        sys.exit(1)
    
    args = sys.argv[1:]
    
    # Find output file
    output_file = 'merged_dataset.json'
    if '-o' in args:
        idx = args.index('-o')
        output_file = args[idx + 1]
        args = args[:idx] + args[idx+2:]
    
    # Expand globs
    files = []
    for arg in args:
        if '*' in arg:
            files.extend(glob(arg))
        else:
            files.append(arg)
    
    if not files:
        print("❌ Žádné soubory k spojení!")
        sys.exit(1)
    
    print("🔄 Spojuji datasety...")
    merged = merge_datasets(files)
    
    # Save
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2)
    
    print(f"\n💾 Uloženo do: {output_file}")

if __name__ == '__main__':
    main()
