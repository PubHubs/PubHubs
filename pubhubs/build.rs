extern crate core;

use std::process::Command;

fn main() {
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
