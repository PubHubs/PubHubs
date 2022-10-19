/// Variation of [hairy::hairy_eval_html_custom] that does not require a mutable reference.
///
/// This prevents the "huh, why must this be mutable?" mental interupt when reading the code.
pub fn hairy_eval_html_custom_by_val<'b>(
    template_bytecode: hairy::BytecodeRef<'b>,
    value: hairy::ValueRef<'b>,
    mut custom: impl expry::CustomFuncs,
) -> Result<Vec<u8>, String> {
    hairy::hairy_eval_html_custom(template_bytecode, value, &mut custom)
}
