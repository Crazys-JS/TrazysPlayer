import { LoopMode } from "../library/audioChannel";
import Bot from "../library/bot";
import { Command, GuildInteraction } from "../library/command";

export default class extends Command {
    public constructor() {
        super("loop", "Change loop mode.");
        this.addStringOption(builder => 
            builder.setName("mode")
            .setDescription("Loop mode.")
            .addChoices(
                {name: "None", value: "off"},
                {name: "Loop Single", value: "single"},
                {name: "Loop All", value: "all"}
            )
            .setRequired(true)
        )
    }
    
    public async execute(bot: Bot, interaction: GuildInteraction): Promise<any> {
        const givenMode = interaction.options.getString("mode", true);
        if(!givenMode) interaction.reply("Please provide a mode.");

        const member = interaction.member;
        const voiceState = member.voice;
        let audio = bot.AudioChannels.get(interaction.guild);
    
        if(!audio) return interaction.reply("I am not in a Voice Channel.");
        if(!voiceState || !voiceState.channel || voiceState.channel !== audio.voiceChannel) return interaction.reply("Please join this Voice Channel.");
        
        let result: string;
    
        switch(givenMode) {
            case "off":
                result = audio.ChangeLoopMode(LoopMode.NoLoop, member)
                break;
            case "single":
                result = audio.ChangeLoopMode(LoopMode.LoopSingle, member)
                break;
            default:
                result = audio.ChangeLoopMode(LoopMode.LoopAll, member)
                break;
        }
    
        interaction.reply(result);
    }
}