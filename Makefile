.DEFAULT_GOAL := server

.PHONY: help install uninstall server

help:
	@echo ""
	@echo "\033[2mSetup\033[0m"
	@echo "  \033[36minstall\033[0m    Install Python deps and register LaunchAgent"
	@echo "  \033[36muninstall\033[0m  Unload and remove the LaunchAgent"
	@echo ""
	@echo "\033[2mDev\033[0m"
	@echo "  \033[36mserver\033[0m     Start the local WebSocket server manually"
	@echo ""

install:
	bash native/install.sh

uninstall:
	launchctl unload "$(HOME)/Library/LaunchAgents/io.github.mouseremote.server.plist" 2>/dev/null || true
	rm -f "$(HOME)/Library/LaunchAgents/io.github.mouseremote.server.plist"
	@echo "✓ Removed LaunchAgent"

server:
	python3 native/server.py
