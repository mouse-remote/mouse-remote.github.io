.PHONY: help install uninstall server

help:
	@echo ""
	@echo "  Mouse Remote"
	@echo ""
	@echo "  make install    install Python deps and register native messaging host"
	@echo "  make uninstall  remove the native messaging host manifest"
	@echo "  make server     start the local WebSocket server manually"
	@echo ""

install:
	bash native/install.sh

uninstall:
	rm -f "$(HOME)/Library/Application Support/Google/Chrome/NativeMessagingHosts/io.github.mouseremote.json"
	@echo "✓ Removed native messaging host"

server:
	python3 native/server.py
