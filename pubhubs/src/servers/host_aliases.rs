
#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(transparent)]
pub struct HostAliases {
    map: std::collections::HashMap<String, HostAlias>,
}

impl PrepareConfig<()> for HostAliases {
    fn prepare(&mut self) -> anyhow::Result<()> {
        let todo : std::collections::HashSet<&str> = self.map.keys().collect();

        while len(todo) > 0 {
            let deps_stack : Vec<&str> = !vec{ todo.iter().next().unwrap() };
            let deps_set : std::collections::HashSet<&str> = deps_stack.iter().collect();

            while len(deps_stack) > 0 {
                let ha_key = dep_stack.last().unwrap();
                
                let ha = self.get_mut(&ha_key).unwrap();
                
            
                `
            }

        }
        
    }
}
