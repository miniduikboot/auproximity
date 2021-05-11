import {
	DtlsParameters,
	IceCandidate,
	IceParameters,
} from "mediasoup-client/lib/types";

export interface RtcTransportParameters {
	id: string;
	iceParameters: IceParameters;
	iceCandidates: Array<IceCandidate>;
	dtlsParameters: DtlsParameters;
}
