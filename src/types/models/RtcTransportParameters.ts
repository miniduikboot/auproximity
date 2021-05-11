import {
	DtlsParameters,
	IceCandidate,
	IceParameters,
} from "mediasoup/lib/types";

export interface RtcTransportParameters {
	id: string;
	iceParameters: IceParameters;
	iceCandidates: Array<IceCandidate>;
	dtlsParameters: DtlsParameters;
}
