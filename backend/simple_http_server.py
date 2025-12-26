import http.server
import socketserver
import os

PORT = 8080

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            html_content = """
<!DOCTYPE html>
<html>
<head>
    <title>Test Server</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            background-color: #1f2937; 
            color: white; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            height: 100vh; 
            margin: 0; 
        }
        .container { 
            text-align: center; 
            padding: 2rem; 
            background-color: #374151; 
            border-radius: 8px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎉 Python HTTP Server Working!</h1>
        <p>If you can see this page, the network binding is working.</p>
        <p>The issue is specifically with Vite/Node.js.</p>
    </div>
</body>
</html>
            """
            self.wfile.write(html_content.encode())
        else:
            super().do_GET()

if __name__ == "__main__":
    print(f"Starting simple HTTP server on port {PORT}...")
    print(f"Access it at: http://localhost:{PORT}")
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()
