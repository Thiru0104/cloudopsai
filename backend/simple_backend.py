import http.server
import socketserver
import json
from urllib.parse import urlparse, parse_qs

class SimpleBackendHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'message': 'Backend is running!', 'status': 'ok'}
            self.wfile.write(json.dumps(response).encode())
        
        elif parsed_path.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'status': 'healthy'}
            self.wfile.write(json.dumps(response).encode())
        
        elif parsed_path.path == '/api/v1/dashboard':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {
                'totalNSGs': 5,
                'totalRules': 23,
                'totalResourceGroups': 3,
                'recentActivity': [
                    {'action': 'NSG Created', 'resource': 'web-nsg', 'timestamp': '2024-01-15T10:30:00Z'},
                    {'action': 'Rule Added', 'resource': 'db-nsg', 'timestamp': '2024-01-15T09:15:00Z'}
                ]
            }
            self.wfile.write(json.dumps(response).encode())
        
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            response = {'error': 'Not found'}
            self.wfile.write(json.dumps(response).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

if __name__ == '__main__':
    PORT = 8007
    with socketserver.TCPServer(("", PORT), SimpleBackendHandler) as httpd:
        print(f"Backend server running on http://localhost:{PORT}")
        print(f"Health check: http://localhost:{PORT}/health")
        httpd.serve_forever()