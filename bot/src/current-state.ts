import { defaultState, State } from "./state"

export let currentState: State = { ...defaultState }
const stateListeners: ((s: State) => void)[] = []

export const updateState = (newState: Partial<State>) => {
    const current = currentState = { ...currentState, ...newState }
    stateListeners.forEach(e => e({ ...current }))
}

export const addStateListener = (l: (s: State) => void) => {
    stateListeners.push(l)
}
