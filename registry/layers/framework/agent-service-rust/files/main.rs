use std::env;
use std::io::{Read, Write};
use std::net::TcpListener;

fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "{{port}}".to_string());
    let listener = TcpListener::bind(format!("0.0.0.0:{port}")).expect("bind");

    for stream in listener.incoming() {
        let mut stream = stream.expect("stream");
        let mut buffer = [0_u8; 1024];
        let _ = stream.read(&mut buffer);
        let body = format!(
            "{{\"status\":\"agent\",\"service\":\"{{serviceName}}\",\"library\":\"{{agentLibrary}}\",\"surface\":\"{{agentSurface}}\"}}"
        );
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        stream.write_all(response.as_bytes()).expect("write response");
    }
}
