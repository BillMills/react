import React from 'react';
import '../index.css';
import helpers from'./helpers'


class DrifterPlots extends React.Component {

	constructor(props) {
		super(props);

		helpers.initPlottingPage.bind(this)(['wmo', 'platform'])

		if(this.state.wmo){
			this.state.title = 'Drifter WMO ' + this.state.wmo
		} else if(this.state.platform){
			this.state.title = 'Drifter platform ' + this.state.platform
		}

		helpers.downloadData.bind(this)('sst', 'sst1', '[2D plot]', 'timestamp', true)
	}

	prepCSV(data, meta){
		// no csv required for drifter
		this.csv = null
	}

    componentDidUpdate(prevProps, prevState, snapshot){
    	this.state.refreshData = false
	    helpers.setQueryString.bind(this)()
    }

	generateURLs(){
		// return an array of API URLs to be fetched based on current state variables.

		let urls = []

		if(this.state.wmo){
			urls = urls.concat(this.apiPrefix + 'drifters/?compression=array&data=all&wmo=' + this.state.wmo)
		} else if(this.state.platform){
			urls = urls.concat(this.apiPrefix + 'drifters/?compression=array&data=all&platform=' + this.state.platform)
		}

		return urls
	}

	generateMetadataURLs(metakeys){
		return metakeys.map(x => this.apiPrefix + 'drifters/meta?id=' + x)
	}

	render(){
		helpers.prepPlotlyState.bind(this)(6)

		return(
			<>
				{helpers.plotHTML.bind(this)()}
			</>
		)
	}
}

export default DrifterPlots