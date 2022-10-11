import { spawn as nodeSpawn } from 'child_process'
const runningProcesses: Array<ReturnType<typeof nodeSpawn>> = []

export const spawn = (cmd: ReadonlyArray<string>) => {
    const process = nodeSpawn(cmd[0], cmd.slice(1), { stdio: 'ignore' })
    runningProcesses.push(process)

    process.addListener('exit', () => {
        const index = runningProcesses.indexOf(process)
        if (index >= 0) runningProcesses.splice(index)
    })

    return process
}

process.addListener('exit', () => {
    runningProcesses.forEach(p => p.kill(15))
})