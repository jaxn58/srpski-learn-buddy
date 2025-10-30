#!/bin/bash
echo "=== Serbian AI Tutor - Status Check ==="
echo ""
echo "Server Status:"
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://3001-iqacib26gtea9n0c4tl3t-f153ff3c.manusvm.computer
echo ""
echo "TypeScript Compilation:"
cd /home/ubuntu/serbian-ai-tutor && pnpm tsc --noEmit 2>&1 | tail -5
echo ""
echo "Recent Logs:"
tail -3 /tmp/*.log 2>/dev/null | grep -v "DOM storage" | head -10
echo ""
echo "=== Status Check Complete ==="
