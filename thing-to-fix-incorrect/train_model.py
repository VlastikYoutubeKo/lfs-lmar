#!/usr/bin/env python3
"""
Turn Detection ML Trainer
==========================
Natrénuje model pro detekci zatáček z anotovaných dat.
"""

import json
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import sys

def load_dataset(filepath):
    """Načte anotovaný dataset."""
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def extract_features(dataset):
    """Extrahuje features pro ML."""
    X = []
    y = []
    
    for example in dataset['dataset']:
        # Features:
        # 1. angleDiff (úhel zatáčky)
        # 2. speed (rychlost)
        # 3. variance of before angles
        # 4. variance of after angles
        
        angle_diff = example['angleDiff']
        speed = example.get('speed', 20)  # default pokud chybí
        
        before_angles = example['features']['beforeAngles']
        after_angles = example['features']['afterAngles']
        
        # Variance úhlů před a po
        before_var = np.var(before_angles) if len(before_angles) > 0 else 0
        after_var = np.var(after_angles) if len(after_angles) > 0 else 0
        
        features = [
            abs(angle_diff),        # Absolutní úhel
            angle_diff,             # Směr zatáčky (+ nebo -)
            speed,                  # Rychlost
            before_var,             # Variance před
            after_var,              # Variance po
            len(before_angles),     # Počet bodů před
            len(after_angles)       # Počet bodů po
        ]
        
        X.append(features)
        y.append(example['turnType'])
    
    return np.array(X), np.array(y)

def train_model(X, y):
    """Natrénuje Random Forest classifier."""
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Train model
    print(f"\n🤖 Trénuji model na {len(X_train)} příkladech...")
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42
    )
    clf.fit(X_train, y_train)
    
    # Evaluate
    train_score = clf.score(X_train, y_train)
    test_score = clf.score(X_test, y_test)
    
    print(f"✅ Train accuracy: {train_score:.2%}")
    print(f"✅ Test accuracy: {test_score:.2%}")
    
    # Predictions
    y_pred = clf.predict(X_test)
    
    print("\n📊 Classification Report:")
    print(classification_report(y_test, y_pred))
    
    print("\n🔢 Confusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    
    # Feature importance
    print("\n📈 Feature Importance:")
    feature_names = [
        'abs(angleDiff)',
        'angleDiff',
        'speed',
        'before_variance',
        'after_variance',
        'before_count',
        'after_count'
    ]
    
    for name, importance in zip(feature_names, clf.feature_importances_):
        print(f"  {name:20s}: {importance:.4f}")
    
    return clf, X_test, y_test

def analyze_thresholds(dataset):
    """Analyzuje optimální prahy pro různé typy zatáček."""
    print("\n📐 Analýza úhlových prahů:")
    
    turn_angles = {}
    
    for example in dataset['dataset']:
        turn_type = example['turnType']
        angle = abs(example['angleDiff'])
        
        if turn_type not in turn_angles:
            turn_angles[turn_type] = []
        turn_angles[turn_type].append(angle)
    
    thresholds = {}
    
    for turn_type, angles in sorted(turn_angles.items()):
        angles = np.array(angles)
        mean = np.mean(angles)
        std = np.std(angles)
        min_a = np.min(angles)
        max_a = np.max(angles)
        
        print(f"\n  {turn_type}:")
        print(f"    Min:  {min_a:.1f}°")
        print(f"    Max:  {max_a:.1f}°")
        print(f"    Mean: {mean:.1f}°")
        print(f"    Std:  {std:.1f}°")
        
        thresholds[turn_type] = {
            'min': float(min_a),
            'max': float(max_a),
            'mean': float(mean),
            'std': float(std)
        }
    
    # Doporučené prahy
    print("\n💡 Doporučené parametry pro detectTurn():")
    
    # slight vs normal
    if 'slight_left' in thresholds and 'left' in thresholds:
        slight_max = thresholds['slight_left']['max']
        left_min = thresholds['left']['min']
        slight_threshold = (slight_max + left_min) / 2
        print(f"  slightTurnAngle: {slight_threshold:.0f}°")
    
    # normal vs sharp
    if 'left' in thresholds and 'sharp_left' in thresholds:
        left_max = thresholds['left']['max']
        sharp_min = thresholds['sharp_left']['min']
        sharp_threshold = (left_max + sharp_min) / 2
        print(f"  sharpTurnAngle: {sharp_threshold:.0f}°")
    
    # minimum angle
    all_angles = []
    for angles in turn_angles.values():
        all_angles.extend(angles)
    min_turn_angle = np.min(all_angles)
    print(f"  minTurnAngle: {min_turn_angle:.0f}°")
    
    return thresholds

def generate_config(thresholds):
    """Vygeneruje config pro JavaScript."""
    config = {
        'minTurnAngle': 35,  # Bude aktualizováno
        'slightTurnAngle': 60,
        'sharpTurnAngle': 110,
        'turnWindow': 5,
        'minTurnDistance': 30,
        'detectRoundabouts': True
    }
    
    # Update based on analysis
    all_angles = []
    for turn_type, data in thresholds.items():
        all_angles.append(data['min'])
    
    if all_angles:
        config['minTurnAngle'] = int(min(all_angles) * 0.8)  # 80% of minimum
    
    if 'slight_left' in thresholds and 'left' in thresholds:
        slight_max = thresholds['slight_left']['max']
        left_min = thresholds['left']['min']
        config['slightTurnAngle'] = int((slight_max + left_min) / 2)
    
    if 'left' in thresholds and 'sharp_left' in thresholds:
        left_max = thresholds['left']['max']
        sharp_min = thresholds['sharp_left']['min']
        config['sharpTurnAngle'] = int((left_max + sharp_min) / 2)
    
    print("\n📝 Vygenerovaný config:")
    print(json.dumps(config, indent=2))
    
    return config

def export_model(clf, config, output_file):
    """Exportuje natrénovaný model a config."""
    # Bohužel nemůžeme exportovat sklearn model do JS přímo
    # Ale můžeme exportovat pravidla
    
    export_data = {
        'exportedAt': np.datetime64('now').astype(str),
        'modelType': 'RandomForest',
        'config': config,
        'instructions': 'Použij config parametry v detectTurn() funkci'
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(export_data, f, indent=2)
    
    print(f"\n💾 Model config exportován do: {output_file}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python train_model.py <dataset.json>")
        sys.exit(1)
    
    dataset_file = sys.argv[1]
    
    print("🚀 Turn Detection ML Trainer")
    print("=" * 50)
    
    # Load dataset
    print(f"\n📂 Načítám dataset: {dataset_file}")
    dataset = load_dataset(dataset_file)
    print(f"✅ Načteno {len(dataset['dataset'])} příkladů")
    
    # Extract features
    print("\n🔧 Extrahuji features...")
    X, y = extract_features(dataset)
    print(f"✅ Features shape: {X.shape}")
    print(f"✅ Třídy: {np.unique(y)}")
    
    # Train model
    clf, X_test, y_test = train_model(X, y)
    
    # Analyze thresholds
    thresholds = analyze_thresholds(dataset)
    
    # Generate config
    config = generate_config(thresholds)
    
    # Export
    output_file = 'optimized_config.json'
    export_model(clf, config, output_file)
    
    print("\n✅ HOTOVO!")
    print("\nDalší kroky:")
    print("1. Zkontroluj optimized_config.json")
    print("2. Použij tyto parametry v navSettingsManager.defaults")
    print("3. Otestuj na nových trasách")

if __name__ == '__main__':
    main()
