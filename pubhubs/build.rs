fn main() {
    #[cfg(all(feature = "old", feature = "bin"))]
    {
        old::generate_css();
        old::generate_global_client_folder();
    }
}

#[cfg(all(feature = "old", feature = "bin"))]
mod old {
    use std::fs::create_dir;
    use std::path::Path;
    use std::process::Command;

    fn npm_command() -> Command {
        if cfg!(target_family = "windows") {
            let mut cmd = Command::new("powershell");
            cmd.arg("npm");
            cmd
        } else if cfg!(target_family = "unix") {
            Command::new("npm")
        } else {
            panic!("unknown target family")
        }
    }

    pub fn generate_css() {
        let guard = chdir(std::path::Path::new("static/scss"));

        let output_install = npm_command()
            .args(["install"])
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

        let output = npm_command()
            .args([
                "run",
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

        drop(guard);
    }

    pub fn generate_global_client_folder() {
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

    struct ChangeDirGuard {
        old_path: std::path::PathBuf,
    }

    impl Drop for ChangeDirGuard {
        fn drop(&mut self) {
            std::env::set_current_dir(&self.old_path).unwrap();
        }
    }

    fn chdir(path: &std::path::Path) -> ChangeDirGuard {
        let cd = std::env::current_dir().unwrap();
        std::env::set_current_dir(path).unwrap();
        ChangeDirGuard { old_path: cd }
    }
}
