const mutator = {
    mutate: (state: any, keys: Array<{ key: string, value?: any }>) => {
        let newState = state
        for (let i = 0; i < keys.length; i++) {
            if (Object.entries(keys[i]).length > 1) {
                newState[keys[i].key] = keys[i].value
            } else {
                newState[keys[i].key] = !newState[keys[i].key]
            }
        }
        return newState
    }
}
export default mutator