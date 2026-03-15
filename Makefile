.DEFAULT_GOAL := server

.PHONY: help install uninstall server

help:
	@echo ""
	@echo "\033[2mSetup\033[0m"
	@echo "  \033[36minstall\033[0m    Install Python deps and register native messaging host"
	@echo "  \033[36muninstall\033[0m  Remove the native messaging host manifest"
	@echo ""
	@echo "\033[2mDev\033[0m"
	@echo "  \033[36mserver\033[0m     Start the local WebSocket server manually"
	@echo ""

install:
	bash native/install.sh

uninstall:
	rm -f "$(HOME)/Library/Application Support/Google/Chrome/NativeMessagingHosts/io.github.mouseremote.json"
	@echo "✓ Removed native messaging host"

server:
	python3 native/server.py
