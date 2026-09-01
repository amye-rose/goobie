export interface Schedule {
    /** run the task now, subject to the same overlap guard as a normal tick */
    runNow: () => void
    /** stop future ticks; an in-flight run is left to finish */
    stop: () => void
}

/**
 * Runs `task` immediately, then every `minutes`. Ticks are serialised: if a run
 * takes longer than the interval (slow feeds, many users) the next tick is
 * skipped rather than stacking. A task that throws is logged and the schedule
 * keeps going, so one bad cycle can't silently stop the bot polling.
 */
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
