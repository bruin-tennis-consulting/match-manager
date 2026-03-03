#!/bin/bash

# Check if Python dependencies are installed

echo "Checking Python dependencies..."
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"
echo ""

# Check pandas
echo "Checking for pandas..."
if python3 -c "import pandas" 2>/dev/null; then
    echo "✓ pandas is installed"
    python3 -c "import pandas; print('  Version:', pandas.__version__)"
else
    echo "❌ pandas is NOT installed"
    echo "  Install with: pip3 install --user pandas"
fi
echo ""

# Check numpy
echo "Checking for numpy..."
if python3 -c "import numpy" 2>/dev/null; then
    echo "✓ numpy is installed"
    python3 -c "import numpy; print('  Version:', numpy.__version__)"
else
    echo "❌ numpy is NOT installed"
    echo "  Install with: pip3 install --user numpy"
fi
echo ""

# Summary
if python3 -c "import pandas, numpy" 2>/dev/null; then
    echo "✅ All dependencies are installed!"
    exit 0
else
    echo "❌ Some dependencies are missing. Please install them:"
    echo "   pip3 install --user pandas numpy"
    exit 1
fi
