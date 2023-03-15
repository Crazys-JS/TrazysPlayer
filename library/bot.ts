import { CacheType, Client, Collection, Guild, Interaction, REST, Routes } from "discord.js";
import * as fs from "fs";
import { Command, GuildInteraction } from "./command";
import AudioChannel from "./audioChannel";

export default class Bot extends Client {
    public commands: Collection<string, Command> = new Collection();
    public AudioChannels: Collection<Guild, AudioChannel> = new Collection();
    private _restModule: REST;

    private _appID: string;

    public constructor(token: string, appID: string) {
        super({intents: [
            "GuildMembers", 
            "MessageContent", 
            "GuildMessages", 
            "GuildMessageReactions",
            "GuildVoiceStates", 
            "Guilds", 
            "GuildPresences"
        ]})

        // Construct and prepare an instance of the REST module
        
        const files = fs.readdirSync("./commands").filter(x => x.endsWith(".ts"));
        for(const file of files) {
            const command = new (require("../commands/" + file).default)() as Command;
            this.commands.set(command.name, command);
        }

        this._appID = appID;
        
        this.on('ready', this.Ready.bind(this));
        this.on('interactionCreate', this.InteractionCreated.bind(this));
        
        this._restModule = new REST({ version: '10' }).setToken(token);

        this.login(token);
    }

    private async Ready() {
        console.log("Bot is ready.");

        try {
            console.log(`Started refreshing ${this.commands.size} application (/) commands.`);
    
            // The put method is used to fully refresh all commands in the guild with the current set
            const data = await this._restModule.put(
                Routes.applicationCommands(this._appID),
                { body: Array.from(this.commands.values()).map(x => x.toJSON()) },
            ) as any;
    
            console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        } catch (error) {
            // And of course, make sure you catch and log any errors!
            console.error(error);
        }
    }

    private async InteractionCreated(interaction: Interaction<CacheType>) {
        if (!interaction.isChatInputCommand() || !interaction.guild) return;

        const command = this.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }
    
        try {
            await command.execute(this, interaction as GuildInteraction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    }
}