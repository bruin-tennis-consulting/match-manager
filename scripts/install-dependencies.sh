#!/bin/bash

# Installation script for Python dependencies
# This script helps install pandas and numpy for the CSV to HTML generator

echo "Installing Python dependencies for CSV to HTML generator..."
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed. Please install Python 3 first."
    exit 1
fi

echo "Python version:"
python3 --version
echo ""

# Try different installation methods
echo "Attempting to install dependencies..."

# Method 1: Try --user flag (recommended for macOS)
echo "Trying: pip3 install --user pandas numpy"
if pip3 install --user pandas numpy 2>/dev/null; then
    echo "✓ Successfully installed dependencies using --user flag"
    exit 0
fi

# Method 2: Try creating virtual environment
echo ""
echo "Trying: Creating virtual environment..."
if python3 -m venv venv 2>/dev/null; then
    echo "✓ Virtual environment created"
    source venv/bin/activate
    if pip install pandas numpy; then
        echo "✓ Successfully installed dependencies in virtual environment"
        echo ""
        echo "Note: The virtual environment is located at: $(pwd)/venv"
        echo "The API route will automatically use it if it exists."
        exit 0
    fi
fi

# Method 3: Last resort - break-system-packages (with warning)
echo ""
echo "Warning: Standard installation methods failed."
echo "You can try manually with:"
echo "  pip3 install --break-system-packages pandas numpy"
echo ""
echo "Or create a virtual environment manually:"
echo "  python3 -m venv venv"
echo "  source venv/bin/activate"
echo "  pip install pandas numpy"
exit 1
