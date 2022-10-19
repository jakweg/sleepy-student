import Session from './session';


export const defaultState = {
    session: (null as null | Session),
}

export type State = typeof defaultState