import { State } from "./state"

export let currentState: State = { type: 'none' }
const stateListeners: ((s: State) => void)[] = []

export const setCurrentState = (newState: State) => {
    currentState = newState
    stateListeners.forEach(e => e(newState))
}

export const addStateListener = (l: (s: State) => void) => {
    stateListeners.push(l)
}