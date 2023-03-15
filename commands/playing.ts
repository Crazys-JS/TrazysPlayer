import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("playing", "View the currently playing track.");
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        let audio = bot.AudioChannels.get(interaction.guild);

        if(!audio) return interaction.reply("I am not in a Voice Channel.");
        const playing = audio.GetCurrentlyPlayingEmbed();
    
        interaction.reply({embeds: [playing]});
    }
}