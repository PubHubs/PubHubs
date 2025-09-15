fn main() {
    {
        old::generate_global_client_folder();
    }
}

mod old {
    use std::fs::create_dir;
    use std::path::Path;

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
}
