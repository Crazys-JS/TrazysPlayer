import { ChannelType, TextChannel } from "discord.js";
import AudioChannel from "../library/audioChannel";
import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("join", "Make the bot join the voice channel you are currently in.");
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const member = interaction.member;
        const voiceState = member.voice;
    
        if(!voiceState || !voiceState.channel) return interaction.reply("Please join a Voice Channel first.");
    
        const channel = voiceState.channel;
        if(channel.type == ChannelType.GuildStageVoice) return interaction.reply("You are in a Stage Channel. I am unable to operate there.");
        if(!channel.joinable) return interaction.reply("I am unable to join this Voice Channel. Is the channel full? Do I have Voice permissions?");
    
        const success = await AudioChannel.CreateAudioChannel(bot, interaction.channel as TextChannel, channel);
        if(!success.success) return interaction.reply("Couldn't join the Voice Channel.");
    
        interaction.reply("Joined Voice Channel.");
    }
}