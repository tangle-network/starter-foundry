use std::io::{Read, Write};
use std::net::TcpListener;

fn main() {
    let port = std::env::var("PORT").unwrap_or_else(|_| "{{port}}".to_string());
    let listener = TcpListener::bind(format!("127.0.0.1:{port}")).expect("bind listener");
    let database = std::fs::read_to_string("database-config.json")
        .ok()
        .unwrap_or_else(|| "{\"provider\":\"{{databaseProvider}}\"}".to_string());

    for stream in listener.incoming() {
        let mut stream = stream.expect("stream");
        let mut buffer = [0_u8; 1024];
        let _ = stream.read(&mut buffer);
        let body = format!(
            "{{\"status\":\"ok\",\"service\":\"{{serviceName}}\",\"database\":{database}}}"
        );
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        stream.write_all(response.as_bytes()).expect("write response");
        break;
    }
}
