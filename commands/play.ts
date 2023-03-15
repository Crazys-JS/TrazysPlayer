import { ChannelType, SlashCommandStringOption, TextChannel } from "discord.js";
import AudioChannel from "../library/audioChannel";
import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("play", "Plays music using URL. Auto join.");
        this.addStringOption((option) =>  
            option.setName("url")
            .setDescription("The music link URL.")
            .setMaxLength(150)
            .setRequired(true)
        );

        this.addBooleanOption((option) => 
            option.setName("skip")
            .setDescription("Whether or not this track will play immediately. Skips the current track.")
        )
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const option = interaction.options.getString("url", true);
        const playSkip = !!interaction.options.getBoolean("skip", false);

        if(!option) interaction.reply({content: "Provide an URL next time.", ephemeral: true});

        await interaction.deferReply();

        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!voiceState || !voiceState.channel) return interaction.editReply({content: "Please join a Voice Channel first."});
        const channel = voiceState.channel;

        if(!audio) {
            if(channel.type == ChannelType.GuildStageVoice) return interaction.editReply({content: "You are in a Stage Channel. I am unable to operate there."});
            if(!channel.joinable) return interaction.editReply({content: "I am unable to join this Voice Channel. Is the channel full? Do I have Voice permissions?"});
    
            const success = await AudioChannel.CreateAudioChannel(bot, interaction.channel as TextChannel, channel);
            if(!success.success) return interaction.editReply({content: "Couldn't join the Voice Channel."});
            
            audio = success.result;
        } else if(audio.voiceChannel !== channel) return interaction.editReply({content: "I am not in that channel."});

        if(playSkip) {
            if(!audio.GetPrivileges(member).has("SKIPTRACK")) return interaction.editReply("You are not allowed to skip songs without votes.");

            const result = await audio.AddTrackToQueue(member, option, true);
            interaction.editReply(result.result);

            if(result.success && audio.queue.length > 1) {
                const result2 = await audio.Skip(member);
                if(!result2.success) interaction.followUp(result2.result);
            };
        } else {
            const result = await audio.AddTrackToQueue(member, option, false);
            interaction.editReply(result.result);
        }
    }
}