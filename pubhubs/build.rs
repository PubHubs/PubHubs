extern crate core;

use std::process::Command;

fn main() {
    generate_css();
    generate_global_client();
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

fn generate_global_client() {
    let output_install = Command::new("npm")
        .args(["ci", "--prefix", "../global-client"])
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

    let output_install = Command::new("npm")
        .args(["ci", "--prefix", "../hub-client"])
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
        .args(["run", "--prefix", "../global-client", "build"])
        .output()
        .expect("Expected to use global client build script");
    if !output.status.success() {
        let stdout = String::from_utf8(output.stdout).unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        println!("cargo:warning={} {}{}", output.status, stdout, stderr);
        panic!();
    }

    let output = Command::new("cp")
        .args(["-a", "../global-client/dist/.", "static/assets/client"])
        .output()
        .expect("Expected to copy the global client build output");
    if !output.status.success() {
        let stdout = String::from_utf8(output.stdout).unwrap();
        let stderr = String::from_utf8(output.stderr).unwrap();
        println!("cargo:warning={} {}{}", output.status, stdout, stderr);
        panic!();
    }
}
