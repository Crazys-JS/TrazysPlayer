import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";
import PageEmbed from "../library/PageEmbed";

export default class extends Command {
    public constructor() {
        super("queue", "View the current music queue in this server.");
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        let audio = bot.AudioChannels.get(interaction.guild);

        if(!audio) return interaction.reply("I am not in a Voice Channel.");
        PageEmbed.FromInteraction(interaction, audio.GetQueueEmbed.bind(audio));
    }
}