#!/bin/bash

# Quick test script to verify Python script setup

echo "Testing CSV to HTML Generator Setup..."
echo ""

# Check Python
echo "1. Checking Python..."
if command -v python3 &> /dev/null; then
    echo "   ✓ Python 3 found: $(python3 --version)"
else
    echo "   ✗ Python 3 not found"
    exit 1
fi

# Check dependencies
echo ""
echo "2. Checking Python dependencies..."
python3 -c "import pandas, numpy; print('   ✓ pandas and numpy installed')" 2>&1 || {
    echo "   ✗ Missing dependencies. Run: pip install pandas numpy"
    exit 1
}

# Check script exists
echo ""
echo "3. Checking Python script..."
if [ -f "csv_to_html_generator.py" ]; then
    echo "   ✓ csv_to_html_generator.py found"
else
    echo "   ✗ csv_to_html_generator.py not found"
    exit 1
fi

# Check visualization files
echo ""
echo "4. Checking visualization files..."
JS_COUNT=$(ls -1 visuals/compilation/*.js 2>/dev/null | wc -l | tr -d ' ')
CSS_EXISTS=$(test -f visuals/compilation/style.css && echo "yes" || echo "no")

if [ "$JS_COUNT" -eq 12 ] && [ "$CSS_EXISTS" = "yes" ]; then
    echo "   ✓ All 12 JavaScript files found"
    echo "   ✓ style.css found"
else
    echo "   ✗ Missing files. Found $JS_COUNT JS files, CSS: $CSS_EXISTS"
    exit 1
fi

echo ""
echo "✓ All checks passed! Ready to test."
echo ""
echo "To test with a CSV file:"
echo "  python3 csv_to_html_generator.py <csv_file> <player1> <player2> [output.html]"
