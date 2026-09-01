import { Client, Events, GatewayIntentBits, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { addUser, closeDatabase, getReview, latestUpdate, loadReviews, loadUpdates, removeUser } from "./db.ts";
import { pollReviews, pollUpdates, notify, pollUsers } from './polling.ts';
import { startSchedule, type Schedule } from './schedule.ts';
import { createContainer, userID } from './utils.ts';

const token = process.env.DISCORD_TOKEN;
const guildID = process.env.GUILD_ID;

const commands = [
    new SlashCommandBuilder()
    .setName("add")
    .setDescription("add a Goodreads profile")
    .addStringOption(option => 
        option.setName("url")
        .setDescription("link to Goodreads profile")
        .setRequired(true)
    ),

    new SlashCommandBuilder()
    .setName("remove")
    .setDescription("remove a Goodreads profile")
    .addStringOption(option => 
        option.setName("url")
        .setDescription("link to Goodreads profile")
        .setRequired(true)
    ),

    new SlashCommandBuilder()
    .setName("latest")
    .setDescription("get the latest Goodreads update"),

    new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓"),
];

export const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let poll: Schedule | undefined

client.once(Events.ClientReady, async (ready) => {
    await (guildID 
        ? ready.application.commands.set(commands, guildID) 
        : ready.application.commands.set(commands));
    console.log(`Logged in as: ${ready.user.tag}`)
    poll = startSchedule(pollUsers, Number(process.env.POLL_INTERVAL_MINUTES ?? 15))
})

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case "add":
                const addURL = interaction.options.getString("url", true);
                const addID = userID(addURL);
                if (!addID) {
                    await interaction.reply({ content: "Invalid Goodreads profile URL", flags: MessageFlags.Ephemeral });
                    return;
                }
                addUser({
                    user_id: addID,
                    username: interaction.user.username,
                    avatar_url: interaction.user.displayAvatarURL(),
                    date_added: new Date().toISOString()
                })
                
                const addReviews = await pollReviews(addID)
                loadReviews(addReviews)

                const addUpdates = await pollUpdates(addID)
                loadUpdates(addUpdates)

                await interaction.reply(`Added user: ${addURL}`);
                break;

            case "remove":
                const removeURL = interaction.options.getString("url", true);
                const removeID = userID(removeURL);
                if (!removeID) {
                    await interaction.reply({ content: "Invalid Goodreads profile URL", flags: MessageFlags.Ephemeral });
                    return;
                }
                removeUser(removeID)
                await interaction.reply(`Removed user: ${removeURL}`);
                break;

            case "latest":
                const update = latestUpdate()
                const review = update ? getReview(update.review_id) : undefined
                if (!review) {
                    await interaction.reply({ content: "No updates yet!", flags: MessageFlags.Ephemeral });
                    return;
                }
                await notify(createContainer(review), client)
                await interaction.reply({ content: "Posted the latest update", flags: MessageFlags.Ephemeral });
                break;

            case "ping":
                await interaction.reply(`🏓 ${Math.round(client.ws.ping)} ms`)
                poll?.runNow()
                break;

            default:
                await interaction.reply({ content: "Unknown command", flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        console.error(`Error handling /${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) return;
        await interaction.reply({ content: "Something went wrong!", flags: MessageFlags.Ephemeral });
    }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, async () => {
        console.log(`Received ${signal}, shutting down`)
        poll?.stop()
        await client.destroy()
        closeDatabase()
        process.exit(0)
    })
}

await client.login(token)