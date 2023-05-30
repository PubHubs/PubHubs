extern crate core;

use std::fs::create_dir;
use std::path::Path;
use std::process::Command;

fn main() {
    generate_css();
    generate_global_client_folder();
}

fn generate_css() {
    let output_install = Command::new("npm")
        .args(["install", "--prefix", "static/scss/"])
        .output()
        .expect("Expected to use npm install");
    if !output_install.status.success() {
        let stdout = String::from_utf8(output_install.stdout).unwrap();
        let stderr = String::from_utf8(output_install.stderr).unwrap();
        println!(
            "cargo:warning={} {}{}",
            output_install.status, stdout, stderr
        );
        panic!();
    }

    let output = Command::new("npm")
        .args([
            "run",
            "--prefix",
            "static/scss/",
            "sass",
            "--update",
            "style.scss:../assets/css/style.css",
        ])
        .output()
        .expect("Expected to use sass");
    if !output.status.success() {
        let stdout = String::from_utf8(output.stdout).unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        println!("cargo:warning={} {}{}", output.status, stdout, stderr);
        panic!();
    }
}

fn generate_global_client_folder() {
    let client_output_dir = Path::new("static/assets/client");
    if client_output_dir.exists() {
        return;
    }

    let res = create_dir(client_output_dir);

    if res.is_err() {
        println!("cargo:warning={:?}", res.err().unwrap());
        panic!();
    }
}
