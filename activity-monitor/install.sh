#!/bin/bash
# Activity Monitor — Install Script (Mac/Linux)
echo "=================================="
echo "  Activity Intensity Monitor Setup"
echo "=================================="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python 3 is required. Install from https://python.org"
    exit 1
fi

echo "Python found: $(python3 --version)"

# Install dependencies
echo "Installing dependencies..."
python3 -m pip install --user -r requirements.txt

echo ""
echo "Setup complete!"
echo ""
echo "To run the monitor:"
echo "  export SUPABASE_KEY=\"your-supabase-anon-key\""
echo "  python3 monitor.py"
echo ""
echo "NOTE: On Mac, you must grant Accessibility and Input Monitoring"
echo "permissions when prompted. Go to:"
echo "  System Settings > Privacy & Security > Accessibility"
echo "  System Settings > Privacy & Security > Input Monitoring"
echo ""
