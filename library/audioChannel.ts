import { joinVoiceChannel, VoiceConnection, AudioPlayer, createAudioResource, NoSubscriberBehavior, PlayerSubscription, AudioPlayerStatus, AudioPlayerState, VoiceConnectionStatus, AudioResource, StreamType } from "@discordjs/voice";
import { Guild, GuildMember, EmbedBuilder, TextChannel, VoiceChannel } from "discord.js";
import ytdl from "ytdl-core-discord";
import ytdlexec from 'youtube-dl-exec';
import Bot from "./bot";
import { ActionResult, MatchYoutubeURL, VideoFormatMilliseconds } from "./util";

export enum LoopMode {
    /**Played tracks are discarded. */
    NoLoop,

    /**Played tracks are never removed causing the same song to play over and over. */
    LoopSingle,

    /**Played tracks are moved from 0 index to last index, causing them to play again while maintaining order. */
    LoopAll
};

export const LoopDisplay: Record<LoopMode, string> = {
    "0": "No Loop",
    "1": "Loop Single",
    "2": "Loop All"
} as const;

export type AudioChannelPrivileges =
    | "PLAYTRACK"
    | "SKIPTRACK"
    | "CLEARQUEUE"
    | "LOOPMODE"
    | "STOP"
    | "MOVECHANNEL" // Currently unused.
    | "VOLUME"

export interface AuthorData {
    name: string,
    avatar?: string,
    url: string
};

export interface TrackData {
    title: string,
    author: AuthorData,

    url: string,
    requester: GuildMember,
    duration: number,
    thumbnail: string,
    nsfw?: boolean
};

export default class AudioChannel {

    private static readonly TracksPerPage = 10;
    public static readonly MAX_VOLUME = 2;
    public static readonly MIN_VOLUME = 0.5;
    private static readonly VOLUME_MULTIPLIER = .5;

    private _subscription: PlayerSubscription;
    private _voiceChannel: VoiceChannel;
    private _textChannel: TextChannel;

    private _queue: TrackData[] = [];
    private _loopMode: LoopMode = LoopMode.NoLoop;
    private _currentResource: AudioResource | null;

    private _guild : Guild;
    private _secured: boolean = false;

    private _volume: number = 1;
    private _voters: Set<GuildMember> = new Set();
    private _userAmount: number = 0;

    public get guild() : Guild {
        return this._guild;
    };

    public get queue(): TrackData[] {
        return this._queue;
    };

    public get voiceChannel(): VoiceChannel {
        return this._voiceChannel
    };

    /**Creates AudioResource from TrackData.  */
    private async GetAudioResource(track: TrackData) {
        const url = track.url;

        const data = await ytdl(url, {filter: "audioonly", quality: "highestaudio", highWaterMark: 1<<25});

        data.on('error', (err) => {
            console.warn(err);
        });

        const resource = createAudioResource(data, {inlineVolume: true, inputType: StreamType.Opus});
        if(resource.volume) resource.volume.setVolume(AudioChannel.VOLUME_MULTIPLIER * this._volume);
        return resource;
    };

    /**Creates {@link TrackData} from url. */
    private GetTrackData(requester: GuildMember, url: string): Promise<TrackData> {
        return new Promise<TrackData>((resolve, reject) => {
            ytdl.getBasicInfo(url)
            .catch((err) => {
                console.warn(err)
                reject(err)
            })
            .then((info) => {
                if(!info) {
                    reject(new Error("This video is either private or the link is invalid."));
                } else {
                    const videoDetails = info.videoDetails;
                    const {title, video_url, author, age_restricted, lengthSeconds, isLiveContent, thumbnails} = videoDetails;

                    const seconds = isLiveContent? 0 : parseInt(lengthSeconds, 10) ?? 0;
                    const milliseconds = seconds * 1000;

                    resolve({
                        title: title,
                        url: video_url,
                        author: {name: author.name, avatar: author.thumbnails? author.thumbnails[0]?.url:undefined, url: author.channel_url},
                        requester: requester,
                        duration: milliseconds,
                        nsfw: age_restricted,
                        thumbnail: thumbnails[0].url
                    });
                };
            });
        });
    };

    /**Adjusts current volume. */
    public AdjustVolume(newVolume: number, requester: GuildMember) {
        if(!this.GetPrivileges(requester).has("VOLUME")) return "You cannot change track volume.";

        if(newVolume > AudioChannel.MAX_VOLUME || newVolume < AudioChannel.MIN_VOLUME) return `Volume must be between ${AudioChannel.MIN_VOLUME} and ${AudioChannel.MAX_VOLUME}. Default volume is 1.`;
        this._volume = newVolume;

        if(this._currentResource && this._currentResource.volume) {
            this._currentResource.volume.setVolume(AudioChannel.VOLUME_MULTIPLIER * newVolume);
        };

        return `Changed track volume to ${newVolume}!`;
    }

    /**Skips to the next track. */
    public async Skip(requester: GuildMember): Promise<ActionResult<string>> {

        if(this._queue.length <= 0) return {
            success: false,
            result: "Nothing is playing. The queue is empty." 
        };

        if(this.GetPrivileges(requester).has("SKIPTRACK")) {
            if(this._loopMode == LoopMode.LoopSingle) this._queue.shift(); //The song is removed from queue instead of restarting incase its LoopSingle.
            if(this._loopMode == LoopMode.LoopAll) this._queue[0] = null; //Sets the first entry to null incase LoopAll, which prevents it from getting readded.
            let success = this._subscription.player.stop();
            
            if(success) {
                return {
                    success: true,
                    result: "Skipping the current track."
                }
            } else {
                return {
                    success: false,
                    result: "Couldn't skip the current track."
                }
            };
        } else {
            /**Skipping votes.*/

            if(this._voters.has(requester)) return {
                success: false,
                result: "You already voted."
            };
            
            this._voters.add(requester);

            let requiredPeople = this._userAmount - 1;
            let voterAmount = this._voters.size;
            let skipped = voterAmount > requiredPeople;

            if(skipped) {
                this._voters.clear();
                if(this._currentResource) {
                    this._currentResource = null;
                    let success = this._subscription.player.stop();
            
                    if(success) {
                        return {
                            success: true,
                            result: "Skipping the current track due to votes."
                        }
                    } else {
                        return {
                            success: false,
                            result: "Couldn't skip the current track."
                        }
                    };

                } else return {
                    success: false,
                    result: "Failed to skip."
                }
            } else return {
                success: false,
                result: `${requester.displayName} voted to skip! [${voterAmount}/${requiredPeople}]`
            };
        };
    };

    /**Returns queue embed. 
     * @returns [Embed, MaxPages] 
     **/
    public GetQueueEmbed(page: number): [EmbedBuilder, number] {
        const {_queue, _loopMode} = this;

        const pageNumber = Math.ceil(_queue.length / AudioChannel.TracksPerPage);
        const toDisplay = _queue.slice(0).splice(page * AudioChannel.TracksPerPage, AudioChannel.TracksPerPage);

        const elements = [];
        let i = page * AudioChannel.TracksPerPage;

        for(const Track of toDisplay) {
            i++;

            const {author, requester, title} = Track;
            const isPlaying = i === 1;

            elements.push(isPlaying? `•${i}: **__${title}__** by **${author.name}** {Added by ${requester.displayName}.} [PLAYING]`:`•${i}: **__${title}__** by **${author.name}** {Added by ${requester.displayName}.}`);
        };

        const embed = new EmbedBuilder()
        .setTitle("Queue")
        .setDescription(elements.join('\n'))
        .setFooter({text: `Loop Mode: ${LoopDisplay[_loopMode]}`});

        if(this._currentResource && this._queue.length > 0) {

            const playing = this._queue[0];
            const length = VideoFormatMilliseconds(this._queue[0].duration);
            const current = VideoFormatMilliseconds(this._currentResource.playbackDuration)

            embed.addFields({name: "Current Track", value: `**__${playing.title}__** by **${playing.author.name}** [${current} | ${length}]`});
        }

        return [embed, pageNumber] as [EmbedBuilder, number];
    };

    /**Changes the loop mode. See {@link LoopMode} enum.*/
    public ChangeLoopMode(newMode: LoopMode, requester: GuildMember): string {
        if(!this.GetPrivileges(requester).has("LOOPMODE")) return `You are not allowed to change the loop mode.`;

        this._loopMode = newMode;
        return `Successfully changed loop mode to \`${LoopDisplay[newMode]}!\``;
    };

    /**Adds a track to the queue, if the added track is the only track in the queue; starts playing that track. */
    public async AddTrackToQueue(requester: GuildMember, url: string, priority?: boolean): Promise<ActionResult<string>> {
        try {
            if(!this.GetPrivileges(requester).has("PLAYTRACK")) return {
                success: false,
                result: "You are not allowed to add tracks to the queue."
            };

            const TrackData = await this.GetTrackData(requester, url);
            if(TrackData.nsfw) return {
                success: false,
                result: "Cannot play age restricted content."
            };

            if(priority && this._queue.length > 0) {
                this._queue.splice(1, 0, TrackData)
            } else {
                this._queue.push(TrackData)
            };

            if(this._queue.length == 1) {
                this.PlayTrack(this._queue[0]);
            };

            return {
                success: true,
                result: `Added **${TrackData.title}** to the queue!`
            };
        } catch(err) {
            console.warn(err);
            return {
                success: false,
                result: "Couldn't find the track."
            };
        };
    };

    /**Checks certain conditions regarding player status. */
    private async PlayerStateChanged(oldState: AudioPlayerState, newState: AudioPlayerState) {
        if(newState.status == AudioPlayerStatus.Idle && oldState.status != AudioPlayerStatus.Idle) {
            this.FinishedPlaying();
        };
    };

    /**Handles how a queue is processed after song ends. */
    private async FinishedPlaying() {
        this._currentResource = null;
        this._voters.clear();

        const loopMode = this._loopMode;

        switch(loopMode) {
            case LoopMode.NoLoop:
                this._queue.shift();
                break;
            case LoopMode.LoopSingle:
                break;
            case LoopMode.LoopAll:
                if(this._queue[0]) {
                    const firstTrack = this._queue.shift();
                    this._queue.push(firstTrack);
                };
                break;
        };

        if(this._queue[0]) {
            //Start playing next song.
            this.PlayTrack(this._queue[0]);
        };
    };

    /**Starts playing a track. */
    private async PlayTrack(trackData: TrackData): Promise<boolean> {
        try {
            const resource = await this.GetAudioResource(trackData);
            this._subscription.player.play(resource);
            this._currentResource = resource;

            return true
        } catch(err) {
            console.warn(err);
            return false
        };
    };

    /**Searches a youtube video using the given keyword. */
    private async SearchKeyword(keyword: string): Promise<string | undefined> {
        let toSearch = keyword.trim();
        let isYoutubeLink = MatchYoutubeURL(toSearch);

        if(isYoutubeLink) {
            return toSearch
        } else {
            try {
                let a = await ytdlexec(`ytsearch:${toSearch}`, {defaultSearch: toSearch, noPlaylist: true, dumpSingleJson: true, skipDownload: true}) as unknown as any;
                if(a && a.entries && a.entries.length > 0) {
                    return a.entries[0].webpage_url
                } else {
                    return undefined
                }
            } catch(err) {
                console.warn(err)
                return undefined;
            }
        };
    };

    /**Updates AudioChannel security mode, which forces voting for ordinary users when attempting to skip songs. */
    private async UsersUpdated() {
        this._userAmount = this._voiceChannel.members.size - 1;

        const enabled = this._userAmount > 2 || !!this._voiceChannel.members.find(x => this._guild.ownerId == x.id || x.permissionsIn(this._voiceChannel).has("Administrator") || !!x.roles.cache.find(y => y.name.toLowerCase() == "dj"));
        this._secured = enabled;
    };

    /**Clears the queue but does not stop the current track. */
    public ClearQueue(requester: GuildMember): string {
        const privilages = this.GetPrivileges(requester);
        if(!privilages.has("CLEARQUEUE")) return "You cannot clear this queue.";

        this._queue.splice(1, this._queue.length - 1);
        return "Successfully cleared the queue.";
    };

    /**Gets the privileges of a member. */
    public GetPrivileges(member: GuildMember): Set<AudioChannelPrivileges> {
        this.UsersUpdated();

        const permissions = member.permissionsIn(this._voiceChannel);
        const isAdministrator = this._guild.ownerId == member.id || permissions.has("Administrator") || member.roles.cache.find(x => x.name.toLowerCase() == "dj");

        const set: Set<AudioChannelPrivileges> = new Set();

        set.add("PLAYTRACK") // This privilige is always granted regardless of rank/role.

        if(isAdministrator) {
            set.add("SKIPTRACK");
            set.add("MOVECHANNEL");
            set.add("CLEARQUEUE");
            set.add("LOOPMODE");
            set.add("STOP");
            set.add("VOLUME");
        } else if(!this._secured) {
            set.add("SKIPTRACK")
            set.add("LOOPMODE");
            set.add("STOP");
        };

        return set;
    };

    /**Destroys the connection. */
    public async destroy(bot: Bot) {
        bot.AudioChannels.delete(this._guild);
        
        try {
            this._subscription.connection.destroy();
            
            if(this._textChannel.permissionsFor(bot.user).has("SendMessages", true)) {
                this._textChannel.send("Leaving the voice channel...");
            };
        } catch(err) {
            console.warn(err)
        };
    };

    /**Gets the embed for the currently playing track. */
    public GetCurrentlyPlayingEmbed(): EmbedBuilder {
        const embed = new EmbedBuilder()

        if(!this._currentResource) {
            embed.setTitle("Currently Playing")
            embed.setDescription("Nothing is playing right now.")
        } else {
            const playingTrack = this._queue[0];
            const {author: {avatar, name, url: authorURL}, duration, title, requester, thumbnail, url} = playingTrack;

            const playbackDuration = VideoFormatMilliseconds(this._currentResource.playbackDuration);
            const length = VideoFormatMilliseconds(duration);

            embed.setTitle(`Currently Playing`)
            embed.setAuthor({name: `Uploader: ${name}`, iconURL: avatar, url: authorURL})
            embed.setDescription(`[${title}](${url})`)
            embed.addFields({name: `Length`, value: `${playbackDuration} | ${length}`})
            embed.setThumbnail(thumbnail);
            embed.setFooter({text: `Added by: ${requester.displayName}`, iconURL: requester.user.displayAvatarURL()});
        };

        return embed;
    };

    /**Creates a new audio channel. */
    private constructor(bot: Bot, connection: VoiceConnection, textChannel: TextChannel, voiceChannel: VoiceChannel) {
        const player = new AudioPlayer({behaviors: {noSubscriber: NoSubscriberBehavior.Pause}});
        const subscription = connection.subscribe(player);

        player.on('stateChange', this.PlayerStateChanged.bind(this));
        player.on('error', (err) => {
            console.warn(err);
            //this.destroy();
        });

        connection.on('error', (err) => {
            console.warn(err);
            this.destroy(bot);
        });

        connection.on('stateChange', (oldState, newState) => {
            if(newState.status == VoiceConnectionStatus.Disconnected) {
                this.destroy(bot);
            };
        });

        this._subscription = subscription;
        this._loopMode = LoopMode.NoLoop;
        this._queue = [];
        this._textChannel = textChannel;
        this._voiceChannel = voiceChannel;
        this._guild = voiceChannel.guild;

        this.UsersUpdated();
    };
    
    /**Creates a new AudioChannel instance, used for playing audio streams into a voice channel and maintaining an audio queue. */
    public static async CreateAudioChannel(bot: Bot, textChannel: TextChannel, voiceChannel: VoiceChannel): Promise<ActionResult<AudioChannel>> {
        const guild = voiceChannel.guild;
        try {
            const connection = joinVoiceChannel({
                adapterCreator: guild.voiceAdapterCreator,
                channelId: voiceChannel.id,
                guildId: guild.id,
                selfDeaf: true
            });

            const created = new AudioChannel(bot, connection, textChannel, voiceChannel);
            bot.AudioChannels.set(guild, created);

            return {
                success: true,
                result: created
            };

        } catch(err) {
            console.warn(err);
            return {
                success: false,
                result: null
            };
        };
    };
    

};