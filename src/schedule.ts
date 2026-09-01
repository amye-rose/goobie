export interface Schedule {
    runNow: () => void
    stop: () => void
}

export function startSchedule(task: () => Promise<void>, minutes: number, name = "poll"): Schedule {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        throw new Error(`Invalid interval for ${name}: ${minutes}`)
    }

    let running = false

    const tick = async () => {
        if (running) {
            console.warn(`Previous ${name} still running, skipping this tick`)
            return
        }

        running = true
        try {
            await task()
        } catch (error) {
            console.error(`${name} failed:`, error)
        } finally {
            running = false
        }
    }

    console.log(`Running ${name} every ${minutes} minute(s)`)
    void tick()
    const timer = setInterval(() => void tick(), minutes * 60_000)

    return {
        runNow: () => void tick(),
        stop: () => clearInterval(timer),
    }
}
