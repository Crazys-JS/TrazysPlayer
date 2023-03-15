import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("leave", "Make the bot leave VC.");
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!audio) return interaction.reply("I am not in a Voice Channel.");
        if(!voiceState || !voiceState.channel || voiceState.channel !== audio.voiceChannel) return interaction.reply("Please join this Voice Channel.");
        
        if(!audio.GetPrivileges(member).has("STOP")) return interaction.reply("You cannot make the bot leave.");
        interaction.reply("Leaving channel...")

        audio.destroy(bot);
    }
}