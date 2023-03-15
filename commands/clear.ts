import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("clear", "Clears the queue.");
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!audio) return interaction.reply("I am not in a Voice Channel.")
        if(!voiceState || !voiceState.channel || voiceState.channel !== audio.voiceChannel) return interaction.reply("Please join a Voice Channel first.");
    
        const result = audio.ClearQueue(member);
        interaction.reply(result);
    }
}