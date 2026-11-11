fn main() {
    // The icons are baked into the exe (Windows resource + window icon). Cargo doesn't
    // watch them by default, so after `pnpm tauri icon` the app kept the old icon.
    println!("cargo:rerun-if-changed=icons");
    tauri_build::build()
}
