#!/usr/bin/env python3
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MinimalHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        logger.info(f"Received GET request: {self.path}")
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        parsed_url = urlparse(self.path)
        path = parsed_url.path
        
        if path == '/api/v1/health':
            response = {"status": "healthy", "message": "Minimal server is running"}
        elif path == '/api/v1/test':
            response = {"test": "success", "message": "Test endpoint working"}
        else:
            response = {"error": "Not found", "path": path}
        
        logger.info(f"Sending response: {response}")
        self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        logger.info(f"Received OPTIONS request: {self.path}")
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8001), MinimalHandler)
    logger.info("Minimal test server running on http://localhost:8001")
    logger.info("Available endpoints:")
    logger.info("  GET /api/v1/health")
    logger.info("  GET /api/v1/test")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Server stopped")
        server.shutdown()