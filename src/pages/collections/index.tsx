import { Authorization } from '../../lib/authorization';
import Layout from '../../lib/components/Layout';
import Error from '../../lib/components/Error';
import Button, { Cta } from '../../lib/components/Button';
import db, { FileCollection, Artifact } from '../../lib/db';
import { useSession } from 'next-auth/client';
import { useState, useEffect } from 'react';
import { MdOpenInNew, MdAdd, MdClose } from 'react-icons/md';
import Link from 'next/link';

export default function Collection(){
    const [session, loading] = useSession();

    const [collections, setCollections] = useState([] as FileCollection[]);
    const [artifacts, setArtifacts] = useState({} as Map<string, number>)
    const [error, setError] = useState(null);

    const [dbLoaded, setDbLoaded] = useState(false);
    const [driveLoaded, setDriveLoaded] = useState(false);
    const [apisLoaded, setApisLoaded] = useState(false);

    async function getData(){
        try {
            const snapshot = await db.file_collections.where('author_id', '==', session.user.id).get();
            const dbCollections = snapshot.docs.map(doc => doc.data());
            const dbArtifacts: Map<string, number> = new Map();

            for(let i = 0; i < dbCollections.length; i++){
                const collection = dbCollections[i];
                const snapshot = await db.artifacts(collection.id).get();
                dbArtifacts[collection.id] = snapshot.docs.length;
            }

            setCollections(dbCollections);
            setArtifacts(dbArtifacts);

            setDbLoaded(true);
        }catch(_e){
            setError('There was an error loading your collections');
        }
    }

    async function getDriveData(client){
        try {
            const drive = await db.drive(client);
            const updated = await Promise.all(collections.map(async collection => {
                const [driveCollection] = await drive.file_collections.load([collection, []]);
                return driveCollection;
            }));

            setCollections(updated);
            setDriveLoaded(true);
        }catch(_e){
            setError('There was an error syncing with drive');
        }
    }

    async function remove(client, collection: FileCollection){
        try {
            if(confirm('Are you sure you want to delete collection "' + collection.title + '"?')){
                const snapshot = await db.artifacts(collection.id).get();
                const collectionArtifacts = snapshot.docs.map(doc => doc.data());
                const drive = await db.drive(client);

                drive.file_collections.remove([
                    collection,
                    collectionArtifacts
                ]);

                for(let i = 0; i < collectionArtifacts.length; i++){
                    const artifact = collectionArtifacts[i];
                    await db.artifacts(collection.id).doc(artifact.id).delete();
                }

                db.file_collections.doc(collection.id).delete();

                setArtifacts(currentArtifacts => ({...currentArtifacts, [collection.id]: undefined}));
                setCollections(currentCollections => currentCollections.filter(c => c.id != collection.id));
            }
        }catch(_e){
            setError('There was an error deleting the collection');
        }
    }

    useEffect(() => {
        if(session && !loading && !dbLoaded){
            getData();
        }

        if(dbLoaded && !driveLoaded && apisLoaded){
            getDriveData(window.gapi.client);
        }
    }, [loading, dbLoaded, driveLoaded, apisLoaded]);

    return (
        <Layout
            authorization={Authorization.USER}
            gapis={[]}
            onGapisLoad={() => setApisLoaded(true)}
            noPadding
        >
            <div className="flex flex-col items-center bg-gradient-to-r from-indigo-300 to-purple-700 w-full py-16 text-white">
                <h1 className="font-bold text-3xl text-center">Your collections</h1>
            </div>
            {error && <div className="w-full">
                <Error error={error}/>
            </div>}
            <div className="flex flex-wrap justify-center py-3 px-5">
                {collections.length > 0 ?
                    <>
                        {collections.map(collection => (
                            <div key={collection.id} className="m-4 bg-purple-100 shadow rounded w-56">
                                <div className="text-gray-600 px-4 pt-1 pb-2">
                                    <div className="flex">
                                        <p className="text-lg font-bold my-2 h-full flex-grow">
                                            <Link href={'/collections/' + collection.id}><a>{collection.title}</a></Link>
                                        </p>
                                        <Button
                                            customPadding
                                            onClick={() => remove(window.gapi.client, collection)}
                                        >
                                            <MdClose/>
                                        </Button>
                                    </div>
                                    <p className="my-2">{artifacts[collection.id]} artifact{artifacts[collection.id] > 1 && 's'}</p>
                                </div>
                                <Button icon={<MdOpenInNew/>} className="bg-purple-300 rounded-b w-full hover:text-white hover:bg-purple-500" customRounding>
                                    <a href={collection.web_view} target="_blank">View in drive</a>
                                </Button>
                            </div>
                        ))}
                        <Cta className="m-4 w-28 text-center flex items-center justify-center bg-gray-200 text-gray-500 bg-gradient-to-r hover:from-purple-500 hover:to-indigo-500 hover:text-white" customBg>
                            <div><Link href="/collections/new"><a><MdAdd size="2em"/></a></Link></div>
                        </Cta>
                    </>
                    :
                    <p className="text-center py-10 text-lg">You don't have any collections yet. <Link href="/collections/new"><a className="text-blue-500 hover:underline">Add one</a></Link></p>
                }
            </div>
        </Layout>
    );
}
